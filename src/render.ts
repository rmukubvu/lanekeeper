import type { ChangeCard } from "./chat/types.js";
import { riskBand } from "./policy.js";
import type { Decision, PRFacts, TriageAssessment } from "./types.js";

const BODY_CHAR_LIMIT = 4_000;

/** Render PR facts into the prompt shared by the triage and explainer agents. */
export function renderFacts(facts: PRFacts): string {
  const meta = {
    repository: `${facts.owner}/${facts.repo}`,
    pull_request: facts.number,
    title: facts.title,
    author: facts.author,
    author_is_bot: facts.authorIsBot,
    base_branch: facts.baseBranch,
    head_branch: facts.headBranch,
    draft: facts.draft,
    additions: facts.additions,
    deletions: facts.deletions,
    files_changed: facts.changedFiles.length,
    ci_checks: facts.checks ?? "unavailable",
    existing_labels: facts.existingLabels,
  };

  const body =
    facts.body.length > BODY_CHAR_LIMIT
      ? `${facts.body.slice(0, BODY_CHAR_LIMIT)}\n... (description truncated)`
      : facts.body;

  const diffs = facts.changedFiles
    .map((f) => {
      const header = `### ${f.path} (${f.status}, +${f.additions}/-${f.deletions})`;
      return f.patch
        ? `${header}\n\`\`\`diff\n${f.patch}\n\`\`\``
        : `${header}\n(no patch available)`;
    })
    .join("\n\n");

  return [
    "## Pull request metadata",
    "```json",
    JSON.stringify(meta, null, 2),
    "```",
    "## Description",
    body || "(no description provided)",
    "## Changed files",
    diffs,
  ].join("\n\n");
}

export function renderScorecard(
  _facts: PRFacts,
  assessment: TriageAssessment,
  decision: Decision,
  model: string,
): string {
  const lines = [
    "## 🛣️ Lanekeeper triage",
    "",
    `**Lane: \`${decision.lane}\`** — ${assessment.summary}`,
    "",
    "| Risk | Value | Urgency | Blast radius | Readiness | Est. review |",
    "|--:|--:|--:|:--|:--|:--|",
    `| ${assessment.risk_score}/100 (${riskBand(assessment.risk_score)}) | ${assessment.value_score}/100 | ${assessment.urgency_score}/100 | ${assessment.blast_radius.replace("_", "-")} | ${assessment.readiness.replace("_", " ")} | ~${assessment.estimated_review_minutes} min |`,
    "",
    "**Why this lane:**",
    ...decision.reasons.map((r) => `- ${r}`),
  ];

  if (assessment.risk_factors.length > 0) {
    lines.push("", "**Risk factors:**", ...assessment.risk_factors.map((r) => `- ${r}`));
  }
  if (assessment.review_focus.length > 0) {
    lines.push("", "**Review focus:**", ...assessment.review_focus.map((r, i) => `${i + 1}. ${r}`));
  }
  if (assessment.fix_suggestions.length > 0) {
    lines.push(
      "",
      "**How to reduce the risk:**",
      ...assessment.fix_suggestions.map((s) => `- **${s.concern}** — ${s.fix} (_${s.where}_)`),
    );
  }
  if (decision.reviewers.length > 0) {
    lines.push("", `**Reviewers requested:** ${decision.reviewers.map((r) => `@${r}`).join(", ")}`);
  }
  if (decision.automerge) {
    lines.push("", "✅ Qualifies for auto-merge under the current policy.");
  }
  lines.push("", `<sub>Categories: ${assessment.categories.join(", ")} · Model: ${model}</sub>`);
  return lines.join("\n");
}

export function buildChangeCard(
  facts: PRFacts,
  assessment: TriageAssessment,
  decision: Decision,
): ChangeCard {
  const band = riskBand(assessment.risk_score);
  const severity =
    decision.lane === "deep" && band === "high"
      ? "critical"
      : decision.lane === "deep"
        ? "attention"
        : "info";

  return {
    title: `PR #${facts.number} → ${decision.lane} lane`,
    subtitle: `${facts.owner}/${facts.repo}: ${facts.title}`,
    url: facts.url,
    severity,
    facts: [
      { label: "Risk", value: `${assessment.risk_score}/100 (${band})` },
      { label: "Author", value: facts.authorIsBot ? `${facts.author} (bot)` : facts.author },
      {
        label: "Size",
        value: `+${facts.additions}/-${facts.deletions} in ${facts.changedFiles.length} files`,
      },
      { label: "Readiness", value: assessment.readiness.replace("_", " ") },
      { label: "Est. review", value: `~${assessment.estimated_review_minutes} min` },
    ],
    body: assessment.summary,
  };
}
