import { describe, expect, it } from "vitest";
import type { SentinelFinding } from "../src/agents/sentinel.js";
import {
  fingerprintFinding,
  meetsSeverity,
  normalizeWhitespace,
  verifyFindings,
} from "../src/sentinel.js";

function finding(overrides: Partial<SentinelFinding> = {}): SentinelFinding {
  return {
    title: "Unbounded polling",
    severity: "high",
    category: "dos",
    file: "src/poll.ts",
    evidence: "setInterval(() => poll(), 2000)",
    explanation: "Polls forever with no backoff.",
    recommendation: "Cap attempts.",
    confidence: "high",
    ...overrides,
  };
}

describe("normalizeWhitespace", () => {
  it("collapses runs of whitespace including newlines", () => {
    expect(normalizeWhitespace("a\n  b\t c ")).toBe("a b c");
  });
});

describe("meetsSeverity", () => {
  it("orders critical > high > medium > low", () => {
    expect(meetsSeverity("critical", "medium")).toBe(true);
    expect(meetsSeverity("medium", "medium")).toBe(true);
    expect(meetsSeverity("low", "medium")).toBe(false);
    expect(meetsSeverity("high", "critical")).toBe(false);
    expect(meetsSeverity("low", "low")).toBe(true);
  });
});

describe("fingerprintFinding", () => {
  it("is stable across whitespace changes in evidence", () => {
    const a = fingerprintFinding(finding());
    const b = fingerprintFinding(finding({ evidence: "setInterval(() =>  poll(),\n2000)" }));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it("differs by file and category", () => {
    const base = fingerprintFinding(finding());
    expect(fingerprintFinding(finding({ file: "src/other.ts" }))).not.toBe(base);
    expect(fingerprintFinding(finding({ category: "logic" }))).not.toBe(base);
  });
});

describe("verifyFindings", () => {
  const contents = new Map([
    ["src/poll.ts", "export function start() {\n  setInterval(() => poll(), 2000)\n}\n"],
  ]);

  it("keeps findings whose evidence appears in the file (whitespace-normalized)", () => {
    const { verified, dropped } = verifyFindings(
      [finding({ evidence: "setInterval(() =>   poll(), 2000)" })],
      contents,
    );
    expect(verified).toHaveLength(1);
    expect(dropped).toBe(0);
  });

  it("drops fabricated evidence", () => {
    const { verified, dropped } = verifyFindings(
      [finding({ evidence: "eval(userInput)" })],
      contents,
    );
    expect(verified).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("drops findings for files that were not scanned", () => {
    const { verified } = verifyFindings([finding({ file: "src/missing.ts" })], contents);
    expect(verified).toHaveLength(0);
  });

  it("drops trivially short evidence", () => {
    const { verified } = verifyFindings([finding({ evidence: "poll()" })], contents);
    expect(verified).toHaveLength(0);
  });
});
