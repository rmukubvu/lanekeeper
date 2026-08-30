import { History } from "lucide-react";
import { LaneIcon } from "@/components/lane";
import { Badge } from "@/components/ui/badge";
import { prKey, type TriageEvent } from "@/lib/api";
import { timeAgo } from "@/lib/time";

/** GitHub-timeline style feed of every triage run, newest first. */
export function Activity({ events }: { events: TriageEvent[] }) {
  const ordered = [...events].reverse();

  if (ordered.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border px-4 py-16 text-center">
        <History className="size-8 text-muted-foreground" />
        <p className="text-muted-foreground">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <ol className="relative ml-2 border-l">
      {ordered.map((event) => (
        <li key={`${prKey(event)}-${event.ts}`} className="relative pb-6 pl-6">
          <span className="absolute -left-[9px] top-0.5 flex size-[18px] items-center justify-center rounded-full border bg-background">
            <LaneIcon lane={event.lane} className="size-3" />
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:text-primary hover:underline"
            >
              {prKey(event)}
            </a>
            <span className="text-muted-foreground">routed to</span>
            <span className="font-medium capitalize">{event.lane}</span>
            <span className="text-muted-foreground">· risk {event.risk}</span>
            {event.dryRun && (
              <Badge variant="outline" className="text-muted-foreground">
                dry run
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo(event.ts)}</span>
          </div>
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">
            {event.title} — {event.summary}
          </p>
        </li>
      ))}
    </ol>
  );
}
