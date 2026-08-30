import { createHash } from "node:crypto";
import { minimatch } from "minimatch";
import type { Octokit } from "octokit";
import {
  SEVERITIES,
  type SentinelFinding,
  type SentinelScanFile,
  type Severity,
  scanForFindings,
} from "./agents/sentinel.js";
import { notify } from "./chat/index.js";
import type { ChangeCard, ChatAdapter } from "./chat/types.js";
import type { Policy } from "./policy.js";
import type { ModelProvider } from "./providers/types.js";

const TOTAL_CONTENT_BUDGET = 150_000;
const MAX_FILE_BYTES = 200_000;
const MIN_EVIDENCE_CHARS = 10;

export const SENTINEL_LABEL = "lanekeeper/sentinel";
const MARKER_PREFIX = "<!-- lanekeeper:sentinel:";

export interface SentinelInput {
  octokit: Octokit;
  provider: ModelProvider;
  policy: Policy;
  adapters: ChatAdapter[];
  owner: string;
  repo: string;
  /** ISO timestamp lower bound; ignored when basehead is given */
  since?: string;
  /** Exact range "base...head" (e.g. from a push webhook) */
  basehead?: string;
  post: boolean;
}

export interface SentinelResult {
  scanned: { base: string; head: string; commits: number; files: number };
  findings: SentinelFinding[];
  droppedUnverified: number;
  belowSeverity: number;
  issues?: { opened: number; skippedExisting: number; urls: string[] };
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function fingerprintFinding(finding: SentinelFinding): string {
  return createHash("sha256")
    .update(`${finding.file}|${finding.category}|${normalizeWhitespace(finding.evidence)}`)
    .digest("hex")
    .slice(0, 12);
}

export function meetsSeverity(severity: Severity, minimum: Severity): boolean {
  return SEVERITIES.indexOf(severity) <= SEVERITIES.indexOf(minimum);
}

/**
 * A finding survives only when its verbatim evidence actually appears in the
 * scanned file (whitespace-normalized). This is the same posture as inline
 * suggestions: fabricated or drifted citations are dropped, never filed.
 */
export function verifyFindings(
  findings: SentinelFinding[],
  contents: Map<string, string>,
): { verified: SentinelFinding[]; dropped: number } {
  const normalized = new Map<string, string>();
  for (const [path, content] of contents) normalized.set(path, normalizeWhitespace(content));

  const verified = findings.filter((finding) => {
    const haystack = normalized.get(finding.file);
    const needle = normalizeWhitespace(finding.evidence);
    return Boolean(haystack) && needle.length >= MIN_EVIDENCE_CHARS && haystack?.includes(needle);
  });
  return { verified, dropped: findings.length - verified.length };
}

function renderIssueBody(
  finding: SentinelFinding,
  scan: SentinelResult["scanned"],
  modelLabel: string,
): string {
  return [
    `## 🛣️ Sentinel finding: ${finding.title}`,
    "",
    "| Severity | Category | Confidence | File |",
    "|---|---|---|---|",
    `| ${finding.severity} | ${finding.category.replace("_", " ")} | ${finding.confidence} | \`${finding.file}\` |`,
    "",
    `**Evidence** (\`${finding.file}\`):`,
    "```",
    finding.evidence,
    "```",
    "",
    `**Why it matters:** ${finding.explanation}`,
    "",
    `**Recommended fix:** ${finding.recommendation}`,
    "",
    `<sub>Post-merge scan ${scan.base.slice(0, 8)}...${scan.head.slice(0, 8)} (${scan.commits} commits, ${scan.files} files) · ${modelLabel}</sub>`,
    `${MARKER_PREFIX}${fingerprintFinding(finding)} -->`,
  ].join("\n");
}

async function resolveRange(
  octokit: Octokit,
  owner: string,
  repo: string,
  input: SentinelInput,
): Promise<
  { base: string; head: string; commits: { sha: string; message: string }[] } | undefined
> {
  if (input.basehead) {
    const [base, head] = input.basehead.split("...");
    const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: input.basehead,
    });
    return {
      base,
      head,
      commits: data.commits.map((c) => ({ sha: c.sha, message: c.commit.message })),
    };
  }

  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const commits = await octokit.rest.repos.listCommits({
    owner,
    repo,
    sha: repoData.default_branch,
    since: input.since,
    per_page: 100,
  });
  if (commits.data.length === 0) return undefined;

  const newest = commits.data[0];
  const oldest = commits.data[commits.data.length - 1];
  const base = oldest.parents[0]?.sha ?? oldest.sha;
  return {
    base,
    head: newest.sha,
    commits: commits.data.map((c) => ({ sha: c.sha, message: c.commit.message })),
  };
}

async function fetchContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | undefined> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    if (
      !Array.isArray(data) &&
      data.type === "file" &&
      "content" in data &&
      data.size <= MAX_FILE_BYTES
    ) {
      return Buffer.from(data.content, "base64").toString("utf8");
    }
  } catch {
    // deleted, binary, or too large — scanned via patch only
  }
  return undefined;
}

export async function runSentinel(input: SentinelInput): Promise<SentinelResult> {
  const { octokit, provider, policy, owner, repo } = input;
  const empty: SentinelResult["scanned"] = { base: "", head: "", commits: 0, files: 0 };

  const range = await resolveRange(octokit, owner, repo, input);
  if (!range || range.commits.length === 0) {
    return { scanned: empty, findings: [], droppedUnverified: 0, belowSeverity: 0 };
  }

  const { data: compare } = await octokit.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${range.base}...${range.head}`,
  });

  const focus = policy.sentinel.paths;
  const candidates = (compare.files ?? [])
    .filter((f) => f.status !== "removed")
    .filter(
      (f) => focus.length === 0 || focus.some((glob) => minimatch(f.filename, glob, { dot: true })),
    )
    .slice(0, policy.sentinel.max_files);

  let budget = TOTAL_CONTENT_BUDGET;
  const files: SentinelScanFile[] = [];
  const contents = new Map<string, string>();
  for (const file of candidates) {
    let content: string | undefined;
    if (budget > 0) {
      content = await fetchContent(octokit, owner, repo, file.filename, range.head);
      if (content) {
        content = content.slice(0, Math.min(content.length, budget));
        budget -= content.length;
        contents.set(file.filename, content);
      }
    }
    files.push({ path: file.filename, status: file.status, patch: file.patch, content });
  }

  const scanned = {
    base: range.base,
    head: range.head,
    commits: range.commits.length,
    files: files.length,
  };
  if (files.length === 0) {
    return { scanned, findings: [], droppedUnverified: 0, belowSeverity: 0 };
  }

  const raw = await scanForFindings(provider, { owner, repo, commits: range.commits, files });
  const { verified, dropped } = verifyFindings(raw, contents);
  const findings = verified.filter((f) => meetsSeverity(f.severity, policy.sentinel.min_severity));
  const belowSeverity = verified.length - findings.length;

  const result: SentinelResult = {
    scanned,
    findings,
    droppedUnverified: dropped,
    belowSeverity,
  };

  if (input.post && findings.length > 0) {
    const existing = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner,
      repo,
      labels: SENTINEL_LABEL,
      state: "open",
      per_page: 100,
    });
    const known = new Set<string>();
    for (const issue of existing) {
      const match = issue.body?.match(new RegExp(`${MARKER_PREFIX}([0-9a-f]{12}) -->`));
      if (match) known.add(match[1]);
    }

    const modelLabel = `${provider.model} · ${provider.name}`;
    const urls: string[] = [];
    let skippedExisting = 0;
    for (const finding of findings) {
      if (known.has(fingerprintFinding(finding))) {
        skippedExisting += 1;
        continue;
      }
      const { data: issue } = await octokit.rest.issues.create({
        owner,
        repo,
        title: `[Sentinel] ${finding.title}`,
        body: renderIssueBody(finding, scanned, modelLabel),
        labels: [SENTINEL_LABEL, `lanekeeper/severity:${finding.severity}`],
      });
      urls.push(issue.html_url);
    }
    result.issues = { opened: urls.length, skippedExisting, urls };

    if (urls.length > 0) {
      const worst = findings.some((f) => f.severity === "critical" || f.severity === "high");
      const card: ChangeCard = {
        title: `Sentinel: ${urls.length} new finding${urls.length === 1 ? "" : "s"} in ${owner}/${repo}`,
        subtitle: `Post-merge scan of ${scanned.commits} commit(s), ${scanned.files} file(s)`,
        url: `https://github.com/${owner}/${repo}/issues?q=is%3Aissue+is%3Aopen+label%3A${encodeURIComponent(SENTINEL_LABEL)}`,
        severity: worst ? "critical" : "attention",
        facts: (["critical", "high", "medium", "low"] as const)
          .map((s) => ({
            label: s,
            value: String(findings.filter((f) => f.severity === s).length),
          }))
          .filter((f) => f.value !== "0"),
        body: findings
          .slice(0, 3)
          .map((f) => `• ${f.title} (${f.severity})`)
          .join("\n"),
      };
      await notify(input.adapters, input.policy.notifications.sentinel ?? [], card);
    }
  }

  return result;
}
