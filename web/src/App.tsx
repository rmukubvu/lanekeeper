import { useQuery } from "@tanstack/react-query";
import { CircleAlert, GitPullRequestArrow, History } from "lucide-react";
import { useState } from "react";
import { Activity } from "@/components/activity";
import { AppHeader } from "@/components/app-header";
import { Queue } from "@/components/queue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UnderlineNav } from "@/components/underline-nav";
import { fetchEvents } from "@/lib/api";

export default function App() {
  const [tab, setTab] = useState("queue");
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    refetchInterval: 15_000,
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader fetching={isFetching} onRefresh={() => refetch()} />

      <main className="mx-auto max-w-[1216px] px-4 py-6">
        <UnderlineNav
          tabs={[
            { id: "queue", label: "Queue", icon: GitPullRequestArrow, count: data?.queue.length },
            { id: "activity", label: "Activity", icon: History, count: data?.events.length },
          ]}
          active={tab}
          onChange={setTab}
        />

        <div className="mt-4">
          {isPending ? (
            <div className="space-y-3 rounded-md border p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-5 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 rounded-md border px-4 py-16 text-center">
              <CircleAlert className="size-8 text-destructive" />
              <p className="font-semibold">Could not load triage events</p>
              <p className="text-muted-foreground">{(error as Error).message}</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : tab === "queue" ? (
            <Queue data={data.queue} />
          ) : (
            <Activity events={data.events} />
          )}
        </div>

        <footer className="mt-8 text-xs text-muted-foreground">
          Lanekeeper · {data?.events.length ?? 0} events recorded · refreshes every 15s
        </footer>
      </main>
    </div>
  );
}
