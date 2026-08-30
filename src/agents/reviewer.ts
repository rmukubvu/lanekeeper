import { z } from "zod";
import { annotatePatch, type RawInlineComment } from "../diff.js";
import type { ModelProvider } from "../providers/types.js";
import type { PRFacts, TriageAssessment } from "../types.js";

const InlineReviewSchema = z.object({
  comments: z.array(
    z.object({
      path: z.string().describe("File path exactly as shown in the diff"),
      line: z
        .number()
        .int()
        .min(1)
        .describe("New-file line number from the annotated gutter (last line of the range)"),
      start_line: z
        .number()
        .int()
        .min(0)
        .describe("First line of a multi-line range; 0 for a single-line comment"),
      original: z
        .string()
        .describe("Exact code content of the line at `line`, without the diff +/space marker"),
      body: z
        .string()
        .describe("Short explanation of the risk and why the change helps (1-3 sentences)"),
      suggestion: z
        .string()
        .describe(
          "Complete replacement text for the commented range, correct indentation, ready to apply; empty string when no concrete code fix fits",
        ),
    }),
  ),
});

export type InlineReview = z.infer<typeof InlineReviewSchema>;

const SYSTEM = `You are the inline reviewer of Lanekeeper, an agentic change-management system. You turn identified risks into precise, applyable fixes anchored to exact lines of a pull request diff.

Rules:
- Only lines that carry a number in the annotated gutter are commentable. Use that number as \`line\` and echo that line's exact code content in \`original\`.
- A suggestion replaces the commented range entirely: for one line set start_line to 0; for a range set start_line to the first line and line to the last, and include replacement text for every line in the range with the file's indentation.
- Suggestions must be grounded in code visible in the diff — never reference symbols, imports, or helpers you cannot see. When a proper fix needs unseen context, leave \`suggestion\` empty and explain what to do in \`body\`.
- Target the material risks (the triage findings are provided). A few high-impact comments beat many nitpicks. Skip style opinions entirely.
- Keep ranges small (under ~15 lines). Do not rewrite whole functions.`;

export async function proposeInlineComments(
  provider: ModelProvider,
  facts: PRFacts,
  assessment: TriageAssessment,
  maxComments: number,
): Promise<RawInlineComment[]> {
  const diffs = facts.changedFiles
    .filter((f) => f.patch)
    .map((f) => `### ${f.path}\n${annotatePatch(f.patch ?? "")}`)
    .join("\n\n");

  const user = [
    `Pull request: ${facts.owner}/${facts.repo}#${facts.number} — ${facts.title}`,
    "",
    "## Triage findings to address",
    `Risk factors:\n${assessment.risk_factors.map((r) => `- ${r}`).join("\n") || "- (none)"}`,
    `Suggested remediations:\n${
      assessment.fix_suggestions.map((s) => `- ${s.concern}: ${s.fix} (${s.where})`).join("\n") ||
      "- (none)"
    }`,
    "",
    `Produce at most ${maxComments} inline comments.`,
    "",
    "## Annotated diff (gutter numbers are NEW-file line numbers)",
    diffs,
  ].join("\n");

  const result = await provider.structured(InlineReviewSchema, {
    system: SYSTEM,
    user,
    schemaName: "inline_review",
  });

  // Fail-safe: no anchored review is better than a fabricated one.
  return result.ok ? result.value.comments : [];
}
