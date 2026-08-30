export type Lane = "auto" | "fast" | "deep";

/** Mirrors TriageEvent in the backend's src/store.ts */
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

export interface EventsResponse {
  /** Latest verdict per PR, newest first */
  queue: TriageEvent[];
  /** Raw activity, oldest first */
  events: TriageEvent[];
}

/** A built-in guideline pack, as served by /api/packs */
export interface Pack {
  id: string;
  title: string;
  paths: string[];
  appliesTo: string[];
  body: string;
}

export async function fetchPacks(): Promise<Pack[]> {
  const res = await fetch("/api/packs");
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  const data = (await res.json()) as { packs: Pack[] };
  return data.packs;
}

export async function fetchEvents(): Promise<EventsResponse> {
  const res = await fetch("/api/events");
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return res.json() as Promise<EventsResponse>;
}

export function prKey(event: TriageEvent): string {
  return `${event.owner}/${event.repo}#${event.number}`;
}
