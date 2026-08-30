import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EventStore, type TriageEvent } from "../src/store.js";

function event(overrides: Partial<TriageEvent>): TriageEvent {
  return {
    ts: "2026-08-30T10:00:00.000Z",
    owner: "acme",
    repo: "widgets",
    number: 1,
    url: "https://github.com/acme/widgets/pull/1",
    title: "A change",
    author: "alice",
    authorIsBot: false,
    lane: "fast",
    risk: 40,
    value: 50,
    urgency: 30,
    readiness: "ready",
    categories: ["feature"],
    summary: "Does a thing.",
    modelLabel: "claude-opus-5 · anthropic",
    dryRun: false,
    ...overrides,
  };
}

describe("EventStore", () => {
  it("appends and lists events, and keeps only the latest per PR", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanekeeper-test-"));
    const store = new EventStore(dir);

    expect(store.list()).toEqual([]);

    store.append(event({ number: 1, ts: "2026-08-30T10:00:00.000Z", lane: "deep" }));
    store.append(event({ number: 2, ts: "2026-08-30T11:00:00.000Z" }));
    store.append(event({ number: 1, ts: "2026-08-30T12:00:00.000Z", lane: "fast" }));

    expect(store.list()).toHaveLength(3);

    const queue = store.latestPerPR();
    expect(queue).toHaveLength(2);
    expect(queue[0].number).toBe(1); // newest first
    expect(queue[0].lane).toBe("fast"); // re-triage replaced the deep verdict
  });

  it("skips corrupt lines instead of failing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanekeeper-test-"));
    const store = new EventStore(dir);
    store.append(event({}));
    fs.appendFileSync(path.join(dir, "events.jsonl"), "not json\n");
    store.append(event({ number: 2 }));
    expect(store.list()).toHaveLength(2);
  });
});
