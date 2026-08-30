import { minimatch } from "minimatch";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { Decision, Lane, PRFacts, TriageAssessment } from "./types.js";

export const PolicySchema = z.object({
  version: z.number().default(1),
  lanes: z
    .object({
      auto: z
        .object({
          max_risk: z.number().default(20),
          categories: z.array(z.string()).default(["docs", "dependencies", "tests"]),
        })
        .prefault({}),
      fast: z
        .object({
          max_risk: z.number().default(45),
        })
        .prefault({}),
    })
    .prefault({}),
  protected_paths: z.array(z.string()).default([]),
  explainer: z
    .object({
      min_changed_lines: z.number().default(300),
    })
    .prefault({}),
  labels: z
    .object({
      prefix: z.string().default("lanekeeper"),
    })
    .prefault({}),
  reviewers: z.record(z.string(), z.array(z.string())).default({}),
  automerge: z
    .object({
      enabled: z.boolean().default(false),
    })
    .prefault({}),
  inline_suggestions: z
    .object({
      enabled: z.boolean().default(true),
      max_comments: z.number().default(6),
    })
    .prefault({}),
  notifications: z
    .record(z.string(), z.array(z.string()))
    .default({ deep: ["teams"], fast: ["teams"], auto: [] }),
});

export type Policy = z.infer<typeof PolicySchema>;

export function defaultPolicy(): Policy {
  return PolicySchema.parse({});
}

export function parsePolicy(yamlText: string): Policy {
  return PolicySchema.parse(parseYaml(yamlText) ?? {});
}

export function riskBand(score: number): "low" | "medium" | "high" {
  if (score <= 33) return "low";
  if (score <= 66) return "medium";
  return "high";
}

/**
 * The deterministic heart of Lanekeeper: given the facts and the model's
 * assessment, apply the team's checked-in policy. The model scores; the
 * policy decides.
 */
export function decide(facts: PRFacts, assessment: TriageAssessment, policy: Policy): Decision {
  const reasons: string[] = [];

  const protectedHits = facts.changedFiles.filter((f) =>
    policy.protected_paths.some((glob) => minimatch(f.path, glob, { dot: true })),
  );

  const ciFailing = (facts.checks?.failed ?? 0) > 0;

  let lane: Lane;
  if (protectedHits.length > 0) {
    lane = "deep";
    reasons.push(
      `touches protected paths: ${protectedHits
        .slice(0, 5)
        .map((f) => `\`${f.path}\``)
        .join(", ")}${protectedHits.length > 5 ? ` (+${protectedHits.length - 5} more)` : ""}`,
    );
  } else if (assessment.readiness === "incomplete") {
    lane = "deep";
    reasons.push("assessed as incomplete");
  } else if (
    assessment.risk_score <= policy.lanes.auto.max_risk &&
    assessment.categories.every((c) => policy.lanes.auto.categories.includes(c)) &&
    assessment.readiness === "ready" &&
    !ciFailing
  ) {
    lane = "auto";
    reasons.push(
      `risk ${assessment.risk_score} ≤ ${policy.lanes.auto.max_risk} and only auto-eligible categories (${assessment.categories.join(", ")})`,
    );
  } else if (assessment.risk_score <= policy.lanes.fast.max_risk) {
    lane = "fast";
    reasons.push(`risk ${assessment.risk_score} ≤ ${policy.lanes.fast.max_risk}`);
  } else {
    lane = "deep";
    reasons.push(`risk ${assessment.risk_score} > ${policy.lanes.fast.max_risk}`);
  }

  if (ciFailing && lane !== "deep") {
    reasons.push("note: CI has failing checks");
  }

  const prefix = policy.labels.prefix;
  const labels = [`${prefix}/lane:${lane}`, `${prefix}/risk:${riskBand(assessment.risk_score)}`];

  const reviewers = [
    ...new Set(
      Object.entries(policy.reviewers)
        .filter(([glob]) => facts.changedFiles.some((f) => minimatch(f.path, glob, { dot: true })))
        .flatMap(([, names]) => names),
    ),
  ].filter((name) => name !== facts.author);

  const automerge = policy.automerge.enabled && lane === "auto" && !facts.draft && !ciFailing;

  return {
    lane,
    labels,
    reviewers,
    automerge,
    reasons,
    notifyAdapters: policy.notifications[lane] ?? [],
  };
}
