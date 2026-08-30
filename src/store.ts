import fs from "node:fs";
import path from "node:path";
import type { Lane } from "./types.js";

/** One triage run, as shown on the dashboard. */
export interface TriageEvent {
  ts: string;
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  author: string;
  authorIsBot: boolean;
  lane: Lane;
  risk: number;
  value: number;
  urgency: number;
  readiness: string;
  categories: string[];
  summary: string;
  modelLabel: string;
  dryRun: boolean;
}

/**
 * Append-only JSONL event log. Deliberately boring: no database to operate,
 * trivially greppable, and good enough until a real queue/dashboard service
 * earns its keep. Swap for Postgres when multiple replicas need it.
 */
export class EventStore {
  constructor(private readonly dir: string) {}

  private get file(): string {
    return path.join(this.dir, "events.jsonl");
  }

  append(event: TriageEvent): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.appendFileSync(this.file, `${JSON.stringify(event)}\n`);
  }

  list(limit = 1000): TriageEvent[] {
    if (!fs.existsSync(this.file)) return [];
    const lines = fs.readFileSync(this.file, "utf8").split("\n").filter(Boolean);
    const events: TriageEvent[] = [];
    for (const line of lines.slice(-limit)) {
      try {
        events.push(JSON.parse(line) as TriageEvent);
      } catch {
        // skip corrupt lines rather than losing the dashboard
      }
    }
    return events;
  }

  /** Latest event per PR, newest first — the dashboard's queue view. */
  latestPerPR(): TriageEvent[] {
    const byKey = new Map<string, TriageEvent>();
    for (const event of this.list()) {
      byKey.set(`${event.owner}/${event.repo}#${event.number}`, event);
    }
    return [...byKey.values()].sort((a, b) => b.ts.localeCompare(a.ts));
  }
}
