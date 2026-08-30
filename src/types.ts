import { z } from "zod";

export interface ChangedFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  /** Unified diff for this file, possibly truncated to fit the prompt budget */
  patch?: string;
}

export interface CheckSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
}

/** Everything the agents and the policy engine know about a pull request. */
export interface PRFacts {
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  body: string;
  author: string;
  authorIsBot: boolean;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  draft: boolean;
  additions: number;
  deletions: number;
  changedFiles: ChangedFile[];
  checks?: CheckSummary;
  existingLabels: string[];
}

export const CATEGORIES = [
  "feature",
  "bugfix",
  "refactor",
  "docs",
  "dependencies",
  "tests",
  "ci",
  "security",
  "config",
  "other",
] as const;

export const TriageAssessmentSchema = z.object({
  summary: z.string().describe("2-4 sentences: what this change does, and why, in plain language"),
  categories: z.array(z.enum(CATEGORIES)).describe("Every category that applies to this change"),
  risk_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("0 = trivially safe, 100 = extremely likely to break production"),
  value_score: z.number().int().min(0).max(100).describe("Business/user value delivered if merged"),
  urgency_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("How time-sensitive merging is (security fixes and broken builds score high)"),
  blast_radius: z
    .enum(["isolated", "module", "service", "cross_service"])
    .describe("How far effects of a defect in this change would propagate"),
  readiness: z
    .enum(["ready", "needs_work", "incomplete"])
    .describe("Whether the change looks complete and reviewable as-is"),
  risk_factors: z
    .array(z.string())
    .describe("Concrete reasons behind the risk score, most important first"),
  review_focus: z
    .array(z.string())
    .describe("Ordered list of the specific places a human reviewer should look first"),
  fix_suggestions: z
    .array(
      z.object({
        concern: z.string().describe("The risk being addressed, in a few words"),
        fix: z.string().describe("Concrete, actionable change that would reduce this risk"),
        where: z.string().describe("File, function, or area where the fix applies"),
      }),
    )
    .describe("Actionable remediations for the material risk factors; empty if none apply"),
  estimated_review_minutes: z
    .number()
    .int()
    .min(1)
    .describe("Realistic minutes a competent reviewer needs for this change"),
});

export type TriageAssessment = z.infer<typeof TriageAssessmentSchema>;

export type Lane = "auto" | "fast" | "deep";

export interface Decision {
  lane: Lane;
  /** Fully-formed labels to set, e.g. lanekeeper/lane:deep */
  labels: string[];
  /** Reviewers to request (author already excluded) */
  reviewers: string[];
  /** True only when policy allows auto-merge AND the change qualifies */
  automerge: boolean;
  /** Human-readable reasons for the lane decision */
  reasons: string[];
  /** Chat adapter names to notify for this lane */
  notifyAdapters: string[];
}
