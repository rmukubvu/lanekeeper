import fs from "node:fs";
import type { Octokit } from "octokit";
import { generateWalkthrough } from "./agents/explainer.js";
import { assessPullRequest } from "./agents/triage.js";
import { notify } from "./chat/index.js";
import type { ChatAdapter } from "./chat/types.js";
import type { AppConfig } from "./config.js";
import { applyDecision, fetchRepoPolicy, gatherFacts, MARKERS, upsertComment } from "./github.js";
import { decide, defaultPolicy, type Policy, parsePolicy } from "./policy.js";
import type { ModelProvider } from "./providers/types.js";
import { buildChangeCard, renderScorecard } from "./render.js";
import type { EventStore } from "./store.js";
import type { Decision, PRFacts, TriageAssessment } from "./types.js";

export interface PipelineInput {
  octokit: Octokit;
  provider: ModelProvider;
  config: AppConfig;
  adapters: ChatAdapter[];
  /** When set, every run (dry or not) is recorded for the dashboard */
  store?: EventStore;
  owner: string;
  repo: string;
  number: number;
  /** false = dry run: analyze and return results without touching the PR or chat */
  post: boolean;
}

export interface PipelineResult {
  policy: Policy;
  facts: PRFacts;
  assessment: TriageAssessment;
  decision: Decision;
  scorecard: string;
  walkthrough?: string;
}

/** Repo-level lanekeeper.yml wins; local file is the fallback; then defaults. */
async function resolvePolicy(input: PipelineInput): Promise<Policy> {
  const fromRepo = await fetchRepoPolicy(input.octokit, input.owner, input.repo);
  if (fromRepo) return parsePolicy(fromRepo);
  if (fs.existsSync(input.config.policyPath)) {
    return parsePolicy(fs.readFileSync(input.config.policyPath, "utf8"));
  }
  return defaultPolicy();
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { octokit, provider, adapters, owner, repo, number } = input;
  const modelLabel = `${provider.model} · ${provider.name}`;

  const policy = await resolvePolicy(input);
  const facts = await gatherFacts(octokit, owner, repo, number);

  const assessment = await assessPullRequest(provider, facts);
  const decision = decide(facts, assessment, policy);
  const scorecard = renderScorecard(facts, assessment, decision, modelLabel);

  let walkthrough: string | undefined;
  if (facts.additions + facts.deletions >= policy.explainer.min_changed_lines) {
    walkthrough = await generateWalkthrough(provider, facts);
  }

  input.store?.append({
    ts: new Date().toISOString(),
    owner,
    repo,
    number,
    url: facts.url,
    title: facts.title,
    author: facts.author,
    authorIsBot: facts.authorIsBot,
    lane: decision.lane,
    risk: assessment.risk_score,
    value: assessment.value_score,
    urgency: assessment.urgency_score,
    readiness: assessment.readiness,
    categories: assessment.categories,
    summary: assessment.summary,
    modelLabel,
    dryRun: !input.post,
  });

  if (input.post) {
    await applyDecision(octokit, facts, decision, scorecard, policy.labels.prefix);
    if (walkthrough) {
      await upsertComment(octokit, facts, walkthrough, MARKERS.walkthrough);
    }
    await notify(adapters, decision.notifyAdapters, buildChangeCard(facts, assessment, decision));
    // Deliberately not implemented in v1: performing the merge itself.
    // decision.automerge only ever annotates; enabling real merges should be
    // an explicit, reviewed change (branch protection + merge queue first).
  }

  return { policy, facts, assessment, decision, scorecard, walkthrough };
}
