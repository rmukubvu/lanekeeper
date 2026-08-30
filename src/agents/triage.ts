import type { ModelProvider } from "../providers/types.js";
import { renderFacts } from "../render.js";
import { type PRFacts, type TriageAssessment, TriageAssessmentSchema } from "../types.js";

const SYSTEM = `You are the triage engine of an agentic change-management system guarding a production codebase. Pull requests arrive from humans and from AI coding agents; your assessment decides how much human attention each one gets, so honesty and calibration matter more than politeness.

Score the pull request on these dimensions:
- risk_score: likelihood and severity of breakage if merged. Weigh blast radius, auth/payments/data-migration/infra surfaces, concurrency, error handling, schema or contract changes, whether tests cover the new behavior, CI status, and sheer size. Bot-authored PRs deserve extra scrutiny for unrequested behavior changes hidden in large diffs.
- value_score: user or business value delivered if merged.
- urgency_score: how time-sensitive merging is (security fixes, broken-build fixes, and blocking dependencies score high; cosmetic changes score low).
- blast_radius, readiness, categories: as defined in the output schema.
- review_focus: point the human at the exact files/hunks where a defect would hurt most.
- fix_suggestions: for every material risk factor, the concrete remediation — the specific code change, missing test, config guard, or rollout step that would lower the risk. Cite the file or function in "where". Only suggest fixes grounded in what the diff actually shows; no generic advice.

Be conservative: when the diff is truncated or context is missing, score risk higher and say so in risk_factors. Never assume unseen code is fine.`;

/**
 * Fail-safe posture: when the model can't produce an assessment (refusal or
 * unparseable output), route the change to humans rather than guessing low.
 */
function failSafeAssessment(reason: string): TriageAssessment {
  return {
    summary: `Automated triage was unavailable (${reason}). Routing to full human review.`,
    categories: ["other"],
    risk_score: 75,
    value_score: 50,
    urgency_score: 50,
    blast_radius: "service",
    readiness: "needs_work",
    risk_factors: [`automated assessment unavailable: ${reason}`],
    review_focus: ["Full manual review required — no automated assessment available."],
    fix_suggestions: [],
    estimated_review_minutes: 30,
  };
}

export async function assessPullRequest(
  provider: ModelProvider,
  facts: PRFacts,
): Promise<TriageAssessment> {
  const result = await provider.structured(TriageAssessmentSchema, {
    system: SYSTEM,
    user: renderFacts(facts),
    schemaName: "triage_assessment",
  });
  return result.ok ? result.value : failSafeAssessment(result.reason);
}
