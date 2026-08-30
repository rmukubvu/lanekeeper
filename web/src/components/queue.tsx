import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Bot, Check, GitPullRequestArrow, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LANE_ORDER, LANES, LaneBadge, LaneDot, LaneIcon, riskColor } from "@/components/lane";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type Lane, prKey, type TriageEvent } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

const SORTS = [
  { id: "ts", label: "Newest" },
  { id: "risk", label: "Highest risk" },
  { id: "value", label: "Highest value" },
  { id: "urgency", label: "Most urgent" },
] as const;

const columns: ColumnDef<TriageEvent>[] = [
  {
    id: "search",
    accessorFn: (e) =>
      `${e.title} ${e.owner}/${e.repo} ${e.author} ${e.categories.join(" ")}`.toLowerCase(),
  },
  { id: "lane", accessorFn: (e) => e.lane, filterFn: "equals" },
  { id: "risk", accessorFn: (e) => e.risk },
  { id: "value", accessorFn: (e) => e.value },
  { id: "urgency", accessorFn: (e) => e.urgency },
  { id: "ts", accessorFn: (e) => e.ts },
];

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-10 text-center">
          <div className={cn("text-sm font-semibold tabular-nums", className)}>{value}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {label} score: {value}/100
      </TooltipContent>
    </Tooltip>
  );
}

function QueueRow({ event }: { event: TriageEvent }) {
  return (
    <li className="flex gap-3 border-t px-4 py-3 first:border-t-0 hover:bg-muted/60">
      <LaneIcon lane={event.lane} className="mt-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-primary hover:underline"
          >
            {event.title}
          </a>
          {event.authorIsBot && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Bot className="size-3" /> bot
            </Badge>
          )}
          {event.dryRun && (
            <Badge variant="outline" className="text-muted-foreground">
              dry run
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={event.summary}>
          {event.summary}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-medium">{prKey(event)}</span> · {event.author} · triaged{" "}
          {timeAgo(event.ts)} · {event.modelLabel}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-4 sm:flex">
        <Stat label="risk" value={event.risk} className={riskColor(event.risk)} />
        <Stat label="value" value={event.value} />
        <Stat label="urgency" value={event.urgency} />
        <LaneBadge lane={event.lane} />
      </div>
    </li>
  );
}

export function Queue({ data }: { data: TriageEvent[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "ts", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const counts = useMemo(() => {
    const result: Record<Lane, number> = { deep: 0, fast: 0, auto: 0 };
    for (const event of data) result[event.lane] += 1;
    return result;
  }, [data]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, value) =>
      (row.getValue("search") as string).includes(String(value).toLowerCase()),
  });

  const laneFilter = (columnFilters.find((f) => f.id === "lane")?.value ?? null) as Lane | null;
  const setLaneFilter = (lane: Lane | null) =>
    setColumnFilters(lane ? [{ id: "lane", value: lane }] : []);

  const sortId = sorting[0]?.id ?? "ts";
  const rows = table.getRowModel().rows;

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center gap-2 rounded-t-md border-b bg-muted/60 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(!laneFilter && "bg-muted font-semibold")}
            onClick={() => setLaneFilter(null)}
          >
            All
            <span className="text-muted-foreground tabular-nums">{data.length}</span>
          </Button>
          {LANE_ORDER.map((lane) => (
            <Button
              key={lane}
              variant="ghost"
              size="sm"
              className={cn(laneFilter === lane && "bg-muted font-semibold")}
              onClick={() => setLaneFilter(laneFilter === lane ? null : lane)}
            >
              <LaneDot lane={lane} />
              {LANES[lane].label}
              <span className="text-muted-foreground tabular-nums">{counts[lane]}</span>
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filter by title, repo, author…"
              className="h-7 w-64 bg-background pl-8 text-sm"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <ArrowUpDown className="size-3.5" />
                {SORTS.find((s) => s.id === sortId)?.label ?? "Sort"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sortId}
                onValueChange={(value) => setSorting([{ id: value, desc: true }])}
              >
                {SORTS.map((sort) => (
                  <DropdownMenuRadioItem key={sort.id} value={sort.id}>
                    {sort.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          {data.length === 0 ? (
            <>
              <GitPullRequestArrow className="size-8 text-muted-foreground" />
              <p className="font-semibold">No triage events yet</p>
              <p className="max-w-md text-muted-foreground">
                Run <code className="rounded bg-muted px-1 font-mono">npm run triage</code> against
                a pull request, or point PR webhooks at the server, and the queue fills up here.
              </p>
            </>
          ) : (
            <>
              <Check className="size-8 text-success" />
              <p className="text-muted-foreground">Nothing matches the current filters.</p>
            </>
          )}
        </div>
      ) : (
        <ul>
          {rows.map((row) => (
            <QueueRow key={prKey(row.original)} event={row.original} />
          ))}
        </ul>
      )}
    </div>
  );
}
