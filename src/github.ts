import { Octokit } from "octokit";
import type { AppConfig } from "./config.js";
import type { ChangedFile, CheckSummary, Decision, PRFacts } from "./types.js";

/** A comment we manage is identified by an invisible marker so we update it in place. */
export const MARKERS = {
  scorecard: "<!-- lanekeeper:scorecard -->",
  walkthrough: "<!-- lanekeeper:walkthrough -->",
} as const;

const PATCH_CHARS_PER_FILE = 6_000;
const PATCH_CHARS_TOTAL = 180_000;

/** Octokit for one-off CLI mode using a PAT. Server mode gets per-installation clients from the App. */
export function tokenOctokit(config: AppConfig): Octokit {
  return new Octokit({ auth: config.githubToken, baseUrl: config.githubApiUrl });
}

export async function gatherFacts(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number,
): Promise<PRFacts> {
  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });

  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: number,
    per_page: 100,
  });

  let budget = PATCH_CHARS_TOTAL;
  const changedFiles: ChangedFile[] = files.map((f) => {
    let patch: string | undefined;
    if (f.patch && budget > 0) {
      const slice = f.patch.slice(0, Math.min(PATCH_CHARS_PER_FILE, budget));
      budget -= slice.length;
      patch = slice.length < f.patch.length ? `${slice}\n... (patch truncated)` : slice;
    }
    return {
      path: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch,
    };
  });

  let checks: CheckSummary | undefined;
  try {
    const { data } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: pr.head.sha,
      per_page: 100,
    });
    const runs = data.check_runs;
    checks = {
      total: runs.length,
      passed: runs.filter((r) => ["success", "neutral", "skipped"].includes(r.conclusion ?? ""))
        .length,
      failed: runs.filter((r) =>
        ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion ?? ""),
      ).length,
      pending: runs.filter((r) => r.status !== "completed").length,
    };
  } catch {
    // Checks API may be unavailable (no checks, missing permission) — non-fatal.
  }

  return {
    owner,
    repo,
    number,
    url: pr.html_url,
    title: pr.title,
    body: pr.body ?? "",
    author: pr.user?.login ?? "unknown",
    authorIsBot: pr.user?.type === "Bot",
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    headSha: pr.head.sha,
    draft: pr.draft ?? false,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles,
    checks,
    existingLabels: pr.labels.map((l) => l.name),
  };
}

/** Fetch lanekeeper.yml from the target repo's default branch, if present. */
export async function fetchRepoPolicy(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<string | undefined> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path: "lanekeeper.yml" });
    if (!Array.isArray(data) && data.type === "file" && "content" in data) {
      return Buffer.from(data.content, "base64").toString("utf8");
    }
  } catch {
    // No repo-level policy — caller falls back to local file or defaults.
  }
  return undefined;
}

export async function upsertComment(
  octokit: Octokit,
  facts: Pick<PRFacts, "owner" | "repo" | "number">,
  body: string,
  marker: string,
): Promise<void> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: facts.owner,
    repo: facts.repo,
    issue_number: facts.number,
    per_page: 100,
  });
  const existing = comments.find((c) => c.body?.includes(marker));
  const full = `${marker}\n${body}`;
  if (existing) {
    await octokit.rest.issues.updateComment({
      owner: facts.owner,
      repo: facts.repo,
      comment_id: existing.id,
      body: full,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner: facts.owner,
      repo: facts.repo,
      issue_number: facts.number,
      body: full,
    });
  }
}

export async function applyDecision(
  octokit: Octokit,
  facts: PRFacts,
  decision: Decision,
  scorecardMarkdown: string,
  labelPrefix: string,
): Promise<void> {
  // Replace our previous lane/risk labels but leave everyone else's labels alone.
  const kept = facts.existingLabels.filter((l) => !l.startsWith(`${labelPrefix}/`));
  await octokit.rest.issues.setLabels({
    owner: facts.owner,
    repo: facts.repo,
    issue_number: facts.number,
    labels: [...kept, ...decision.labels],
  });

  await upsertComment(octokit, facts, scorecardMarkdown, MARKERS.scorecard);

  if (decision.reviewers.length > 0) {
    try {
      await octokit.rest.pulls.requestReviewers({
        owner: facts.owner,
        repo: facts.repo,
        pull_number: facts.number,
        reviewers: decision.reviewers,
      });
    } catch (err) {
      // Requested users may not be collaborators — log and continue.
      console.warn(`could not request reviewers (${decision.reviewers.join(", ")}):`, err);
    }
  }
}
