/**
 * Seeds sample triage events into an isolated demo data dir and starts the
 * dashboard, so you can see the UI without wiring GitHub or an LLM first.
 */
process.env.LANEKEEPER_DATA_DIR ??= ".lanekeeper-demo";

import fs from "node:fs";
import path from "node:path";
import { EventStore, type TriageEvent } from "../src/store.js";

const dir = process.env.LANEKEEPER_DATA_DIR;
const store = new EventStore(dir);

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

if (!fs.existsSync(path.join(dir, "events.jsonl"))) {
  const demo: Omit<TriageEvent, "ts">[] = [
    {
      owner: "acme",
      repo: "checkout-service",
      number: 481,
      url: "https://github.com/acme/checkout-service/pull/481",
      title: "Migrate payment retries to the new ledger API",
      author: "devin-agent",
      authorIsBot: true,
      lane: "deep",
      risk: 82,
      value: 74,
      urgency: 60,
      readiness: "needs_work",
      categories: ["feature", "security"],
      summary:
        "Rewrites the retry path against the ledger API; touches auth boundaries and a schema migration.",
      modelLabel: "claude-opus-5 · anthropic",
      dryRun: false,
    },
    {
      owner: "acme",
      repo: "checkout-service",
      number: 484,
      url: "https://github.com/acme/checkout-service/pull/484",
      title: "Fix flaky currency-rounding test on arm64",
      author: "maria",
      authorIsBot: false,
      lane: "fast",
      risk: 28,
      value: 45,
      urgency: 55,
      readiness: "ready",
      categories: ["tests", "bugfix"],
      summary: "Pins the decimal context in the rounding test; no production code changed.",
      modelLabel: "claude-opus-5 · anthropic",
      dryRun: false,
    },
    {
      owner: "acme",
      repo: "fleet-telemetry",
      number: 1207,
      url: "https://github.com/acme/fleet-telemetry/pull/1207",
      title: "Bump protobufjs 7.2.5 → 7.2.6",
      author: "renovate",
      authorIsBot: true,
      lane: "auto",
      risk: 8,
      value: 20,
      urgency: 15,
      readiness: "ready",
      categories: ["dependencies"],
      summary: "Routine patch bump, changelog is bugfix-only, CI green.",
      modelLabel: "claude-opus-5 · anthropic",
      dryRun: false,
    },
    {
      owner: "acme",
      repo: "fleet-telemetry",
      number: 1209,
      url: "https://github.com/acme/fleet-telemetry/pull/1209",
      title: "Add per-vehicle sampling config + rollout flag (1.8k lines)",
      author: "claude-code",
      authorIsBot: true,
      lane: "deep",
      risk: 68,
      value: 80,
      urgency: 40,
      readiness: "ready",
      categories: ["feature", "config"],
      summary:
        "Large agent-generated change adding sampling config; walkthrough posted with 4 layers.",
      modelLabel: "qwen3:32b · openai-compatible",
      dryRun: false,
    },
    {
      owner: "acme",
      repo: "driver-app",
      number: 92,
      url: "https://github.com/acme/driver-app/pull/92",
      title: "Update onboarding screenshots in README",
      author: "jonas",
      authorIsBot: false,
      lane: "auto",
      risk: 3,
      value: 18,
      urgency: 10,
      readiness: "ready",
      categories: ["docs"],
      summary: "Docs-only change replacing outdated screenshots.",
      modelLabel: "claude-opus-5 · anthropic",
      dryRun: false,
    },
    {
      owner: "acme",
      repo: "driver-app",
      number: 95,
      url: "https://github.com/acme/driver-app/pull/95",
      title: "Refactor session storage to encrypted keychain",
      author: "priya",
      authorIsBot: false,
      lane: "fast",
      risk: 41,
      value: 66,
      urgency: 35,
      readiness: "ready",
      categories: ["refactor", "security"],
      summary: "Moves token storage to the keychain wrapper; behavior covered by existing tests.",
      modelLabel: "anthropic/claude-opus-5 · openrouter",
      dryRun: true,
    },
  ];

  for (const [i, event] of demo.entries()) {
    store.append({ ...event, ts: minutesAgo((demo.length - i) * 47) });
  }
  console.log(`seeded ${demo.length} demo events into ${dir}/events.jsonl`);
} else {
  console.log(`demo data already present in ${dir}/events.jsonl`);
}

if (!fs.existsSync(path.resolve("web/dist/index.html"))) {
  console.log(
    "note: web UI not built yet — serving the basic fallback page. Run: npm run build:web",
  );
}

await import("../src/dashboard-server.js");
