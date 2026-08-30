import { Monitor, Moon, RefreshCw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Theme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function AppHeader({ fetching, onRefresh }: { fetching: boolean; onRefresh: () => void }) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-[1216px] items-center gap-3 px-4">
        <a href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="text-xl leading-none">🛣️</span>
          Lanekeeper
        </a>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">change management</span>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={cn("size-4", fetching && "animate-spin")} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Switch theme">
                {theme === "dark" ? (
                  <Moon className="size-4" />
                ) : theme === "light" ? (
                  <Sun className="size-4" />
                ) : (
                  <Monitor className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => setTheme(value as Theme)}
              >
                <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
