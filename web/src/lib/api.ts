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
