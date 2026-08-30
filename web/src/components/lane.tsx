import { GitPullRequestArrow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Lane } from "@/lib/api";
import { cn } from "@/lib/utils";

export const LANES: Record<Lane, { label: string; text: string; chip: string; dot: string }> = {
  deep: {
    label: "Deep",
    text: "text-destructive",
    chip: "border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  fast: {
    label: "Fast",
    text: "text-attention",
    chip: "border-attention/40 bg-attention/10 text-attention",
    dot: "bg-attention",
  },
  auto: {
    label: "Auto",
    text: "text-success",
    chip: "border-success/40 bg-success/10 text-success",
    dot: "bg-success",
  },
};

export const LANE_ORDER: Lane[] = ["deep", "fast", "auto"];

export function LaneIcon({ lane, className }: { lane: Lane; className?: string }) {
  return <GitPullRequestArrow className={cn("size-4", LANES[lane].text, className)} />;
}

export function LaneDot({ lane, className }: { lane: Lane; className?: string }) {
  return <span className={cn("size-2 rounded-full", LANES[lane].dot, className)} />;
}

export function LaneBadge({ lane }: { lane: Lane }) {
  return (
    <Badge variant="outline" className={cn("capitalize", LANES[lane].chip)}>
      {LANES[lane].label}
    </Badge>
  );
}

export function riskColor(score: number): string {
  if (score <= 33) return "text-success";
  if (score <= 66) return "text-attention";
  return "text-destructive";
}
