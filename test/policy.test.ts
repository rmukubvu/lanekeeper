import { describe, expect, it } from "vitest";
import { decide, defaultPolicy, parsePolicy, riskBand } from "../src/policy.js";
import type { PRFacts, TriageAssessment } from "../src/types.js";

function facts(overrides: Partial<PRFacts> = {}): PRFacts {
  return {
    owner: "acme",
    repo: "widgets",
    number: 42,
    url: "https://github.com/acme/widgets/pull/42",
    title: "Update docs",
    body: "",
    author: "alice",
    authorIsBot: false,
    baseBranch: "main",
    headBranch: "feature",
    headSha: "abc123",
    draft: false,
    additions: 10,
    deletions: 2,
    changedFiles: [{ path: "README.md", status: "modified", additions: 10, deletions: 2 }],
    checks: { total: 3, passed: 3, failed: 0, pending: 0 },
    existingLabels: [],
    ...overrides,
  };
}

function assessment(overrides: Partial<TriageAssessment> = {}): TriageAssessment {
  return {
    summary: "Docs update.",
    categories: ["docs"],
    risk_score: 5,
    value_score: 30,
    urgency_score: 10,
    blast_radius: "isolated",
    readiness: "ready",
    risk_factors: [],
    review_focus: [],
    estimated_review_minutes: 3,
    ...overrides,
  };
}

describe("policy parsing", () => {
  it("produces a usable default policy from an empty document", () => {
    const policy = defaultPolicy();
    expect(policy.lanes.auto.max_risk).toBe(20);
    expect(policy.lanes.fast.max_risk).toBe(45);
    expect(policy.automerge.enabled).toBe(false);
    expect(policy.labels.prefix).toBe("lanekeeper");
  });

  it("parses partial YAML and fills the rest with defaults", () => {
    const policy = parsePolicy("lanes:\n  fast:\n    max_risk: 60\n");
    expect(policy.lanes.fast.max_risk).toBe(60);
    expect(policy.lanes.auto.max_risk).toBe(20);
  });
});

describe("decide", () => {
  it("routes low-risk docs-only changes to the auto lane", () => {
    const d = decide(facts(), assessment(), defaultPolicy());
    expect(d.lane).toBe("auto");
    expect(d.labels).toContain("lanekeeper/lane:auto");
    expect(d.labels).toContain("lanekeeper/risk:low");
    expect(d.automerge).toBe(false); // off by default even in the auto lane
  });

  it("forces the deep lane when a protected path is touched, regardless of score", () => {
    const policy = parsePolicy("protected_paths:\n  - '.github/workflows/**'\n");
    const f = facts({
      changedFiles: [
        { path: ".github/workflows/deploy.yml", status: "modified", additions: 1, deletions: 1 },
      ],
    });
    const d = decide(f, assessment({ risk_score: 1 }), policy);
    expect(d.lane).toBe("deep");
    expect(d.reasons.join(" ")).toContain("protected paths");
  });

  it("routes by risk thresholds", () => {
    const policy = defaultPolicy();
    expect(
      decide(facts(), assessment({ risk_score: 40, categories: ["feature"] }), policy).lane,
    ).toBe("fast");
    expect(
      decide(facts(), assessment({ risk_score: 80, categories: ["feature"] }), policy).lane,
    ).toBe("deep");
  });

  it("keeps failing-CI changes out of the auto lane", () => {
    const f = facts({ checks: { total: 3, passed: 2, failed: 1, pending: 0 } });
    const d = decide(f, assessment(), defaultPolicy());
    expect(d.lane).not.toBe("auto");
  });

  it("requests reviewers from matching globs and excludes the author", () => {
    const policy = parsePolicy("reviewers:\n  'src/api/**': [alice, bob]\n");
    const f = facts({
      author: "alice",
      changedFiles: [{ path: "src/api/users.ts", status: "modified", additions: 5, deletions: 1 }],
    });
    const d = decide(f, assessment({ categories: ["feature"], risk_score: 40 }), policy);
    expect(d.reviewers).toEqual(["bob"]);
  });

  it("only allows automerge when enabled, auto lane, not draft, CI green", () => {
    const policy = parsePolicy("automerge:\n  enabled: true\n");
    expect(decide(facts(), assessment(), policy).automerge).toBe(true);
    expect(decide(facts({ draft: true }), assessment(), policy).automerge).toBe(false);
    expect(
      decide(facts(), assessment({ risk_score: 90, categories: ["feature"] }), policy).automerge,
    ).toBe(false);
  });
});

describe("riskBand", () => {
  it("bands scores", () => {
    expect(riskBand(0)).toBe("low");
    expect(riskBand(33)).toBe("low");
    expect(riskBand(34)).toBe("medium");
    expect(riskBand(66)).toBe("medium");
    expect(riskBand(67)).toBe("high");
    expect(riskBand(100)).toBe("high");
  });
});
