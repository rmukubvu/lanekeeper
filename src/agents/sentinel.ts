import { z } from "zod";
import type { ModelProvider } from "../providers/types.js";

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SentinelFindingSchema = z.object({
  title: z.string().describe("Short, specific title for the finding"),
  severity: z.enum(SEVERITIES).describe("Realistic impact if exploited or triggered"),
  category: z.enum([
    "injection",
    "authz",
    "tenant_isolation",
    "secrets",
    "crypto",
    "data_exposure",
    "ssrf",
    "dos",
    "supply_chain",
    "unsafe_default",
    "logic",
    "other",
  ]),
  file: z.string().describe("File path exactly as listed in the scan input"),
  evidence: z
    .string()
    .describe(
      "The offending code copied VERBATIM from the file (a few lines). Checked mechanically against the file — findings with fabricated evidence are discarded.",
    ),
  explanation: z.string().describe("Why this is a problem, grounded in the cited code"),
  recommendation: z.string().describe("Concrete fix or mitigation"),
  confidence: z.enum(["high", "medium", "low"]),
});

export type SentinelFinding = z.infer<typeof SentinelFindingSchema>;

const SentinelReportSchema = z.object({
  findings: z.array(SentinelFindingSchema),
});

const SYSTEM = `You are Sentinel, the post-merge security monitor of Lanekeeper. Changes have already merged to the default branch; your job is to catch what pre-merge review missed, using the full current content of the changed files — not just the diff.

Focus on: authorization and tenant-isolation boundaries; injection (SQL, command, template, path); secrets or credentials committed in code; weak or misused crypto; sensitive data exposed via logs, API responses, or traces; SSRF and unvalidated URLs or redirects; denial of service (unbounded loops, polling without backoff, unbounded allocation); supply-chain risk (new dependencies, install scripts, pinned-hash removal); and dangerous defaults or silent fallbacks.

Rules:
- Every finding must cite evidence: copy the exact offending lines verbatim into "evidence". Evidence is checked mechanically against the file; anything that does not match is discarded, so never paraphrase.
- Report only what the provided code shows. Do not speculate about code you cannot see — say nothing rather than guess.
- Fewer, well-founded findings beat volume. Skip style issues and theoretical hardening with no concrete path to harm.
- An empty findings list is a perfectly good outcome.
- Severity reflects realistic impact; confidence reflects how directly the evidence supports the finding.`;

export interface SentinelScanFile {
  path: string;
  status: string;
  patch?: string;
  content?: string;
}

export interface SentinelScanContext {
  owner: string;
  repo: string;
  commits: { sha: string; message: string }[];
  files: SentinelScanFile[];
}

const PATCH_CHAR_LIMIT = 4_000;
const CONTENT_CHAR_LIMIT = 16_000;

export async function scanForFindings(
  provider: ModelProvider,
  context: SentinelScanContext,
): Promise<SentinelFinding[]> {
  const commits = context.commits
    .map((c) => `- ${c.sha.slice(0, 8)} ${c.message.split("\n")[0]}`)
    .join("\n");

  const files = context.files
    .map((f) => {
      const parts = [`### ${f.path} (${f.status})`];
      if (f.patch) {
        const patch =
          f.patch.length > PATCH_CHAR_LIMIT
            ? `${f.patch.slice(0, PATCH_CHAR_LIMIT)}\n... (patch truncated)`
            : f.patch;
        parts.push("What changed:", "```diff", patch, "```");
      }
      if (f.content) {
        const content =
          f.content.length > CONTENT_CHAR_LIMIT
            ? `${f.content.slice(0, CONTENT_CHAR_LIMIT)}\n... (content truncated)`
            : f.content;
        parts.push("Current full content:", "```", content, "```");
      }
      return parts.join("\n");
    })
    .join("\n\n");

  const user = [
    `Repository: ${context.owner}/${context.repo}`,
    "",
    "## Recently merged commits",
    commits || "- (none)",
    "",
    "## Changed files (diff of the merge window + current content)",
    files,
  ].join("\n");

  const result = await provider.structured(SentinelReportSchema, {
    system: SYSTEM,
    user,
    schemaName: "sentinel_report",
  });

  // Fail-safe: no findings is better than fabricated findings.
  return result.ok ? result.value.findings : [];
}
