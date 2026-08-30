import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavTab {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

/** GitHub-style underline navigation (the tab row under a repo header). */
export function UnderlineNav({
  tabs,
  active,
  onChange,
}: {
  tabs: NavTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="flex gap-2 border-b" aria-label="Views">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-1 py-2 text-sm",
              selected ? "border-nav-active font-semibold" : "border-transparent",
            )}
          >
            <span className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted">
              <Icon className="size-4 text-muted-foreground" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
