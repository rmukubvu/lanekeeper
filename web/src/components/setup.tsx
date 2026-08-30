import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchPacks, type Pack } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "feature",
  "bugfix",
  "refactor",
  "docs",
  "dependencies",
  "tests",
  "ci",
  "security",
  "config",
  "other",
] as const;

const PLATFORMS = ["teams", "slack", "discord"] as const;
const LANE_EVENTS = ["deep", "fast", "auto", "sentinel"] as const;

interface WizardState {
  repo: string;
  packs: string[];
  autoMaxRisk: number;
  fastMaxRisk: number;
  autoCategories: string[];
  protectedPaths: string;
  sentinelEnabled: boolean;
  sentinelSeverity: "critical" | "high" | "medium" | "low";
  sentinelWindow: number;
  notifications: Record<(typeof LANE_EVENTS)[number], string[]>;
}

const INITIAL: WizardState = {
  repo: "",
  packs: [],
  autoMaxRisk: 20,
  fastMaxRisk: 45,
  autoCategories: ["docs", "dependencies", "tests"],
  protectedPaths: ".github/workflows/**\ninfra/**",
  sentinelEnabled: true,
  sentinelSeverity: "medium",
  sentinelWindow: 24,
  notifications: { deep: ["teams"], fast: ["teams"], auto: [], sentinel: ["teams"] },
};

const STEPS = ["Guideline packs", "Lanes & protection", "Sentinel", "Notifications", "Export"];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function buildPolicyYaml(state: WizardState): string {
  const protectedPaths = state.protectedPaths
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const lines = [
    `# Lanekeeper policy${state.repo ? ` for ${state.repo}` : ""}`,
    "# Commit this as lanekeeper.yml in the repository's default branch.",
    "version: 1",
    "",
    "lanes:",
    "  auto:",
    `    max_risk: ${state.autoMaxRisk}`,
    `    categories: [${state.autoCategories.join(", ")}]`,
    "  fast:",
    `    max_risk: ${state.fastMaxRisk}`,
    "",
    protectedPaths.length > 0 ? "protected_paths:" : "protected_paths: []",
    ...protectedPaths.map((p) => `  - "${p}"`),
    "",
    "guidelines:",
    "  enabled: true",
    `  packs: [${state.packs.join(", ")}]`,
    '  org_repo: ""  # optional: "my-org/.lanekeeper"',
    "",
    "sentinel:",
    `  enabled: ${state.sentinelEnabled}`,
    `  window_hours: ${state.sentinelWindow}`,
    `  min_severity: ${state.sentinelSeverity}`,
    "",
    "automerge:",
    "  enabled: false  # annotate-only either way",
    "",
    "notifications:",
    ...LANE_EVENTS.map((lane) => `  ${lane}: [${state.notifications[lane].join(", ")}]`),
    "",
  ];
  return lines.join("\n");
}

export const STARTER_GUIDELINE = `---
title: Team standards
paths: []            # scope with globs, e.g. ["src/**/*.go"]
# applies_to: [triage, inline, sentinel]
---
- Replace these with your team's rules — one imperative sentence each.
- Example: wrap errors with %w and compare with errors.Is/As, never string matching.
`;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={onChange}
      />
      {children}
    </label>
  );
}

function PackCard({
  pack,
  selected,
  onToggle,
}: {
  pack: Pack;
  selected: boolean;
  onToggle: () => void;
}) {
  const name = pack.id.replace(/^pack:/, "");
  const rules = pack.body.split("\n").filter((l) => l.trim().startsWith("-"));
  return (
    <div className={cn("rounded-md border p-3", selected && "border-primary bg-primary/5")}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={selected}
          onChange={onToggle}
        />
        <button type="button" onClick={onToggle} className="font-semibold">
          {pack.title}
        </button>
        <code className="text-xs text-muted-foreground">{name}</code>
        <Badge variant="outline" className="ml-auto text-muted-foreground">
          {rules.length} rules
        </Badge>
      </div>
      <p className="mt-1 pl-6 text-xs text-muted-foreground">
        {pack.paths.length > 0 ? `Applies to ${pack.paths.join(", ")}` : "Applies to all files"}
      </p>
      <details className="mt-1 pl-6">
        <summary className="cursor-pointer text-xs text-primary">Preview rules</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {rules.slice(0, 6).map((rule) => (
            <li key={rule}>{rule.replace(/^-\s*/, "")}</li>
          ))}
          {rules.length > 6 && <li>… and {rules.length - 6} more</li>}
        </ul>
      </details>
    </div>
  );
}

const inputClass =
  "h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring";

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL);
  const packsQuery = useQuery({ queryKey: ["packs"], queryFn: fetchPacks });

  const patch = (partial: Partial<WizardState>) => setState((s) => ({ ...s, ...partial }));

  return (
    <div className="mx-auto max-w-3xl rounded-md border">
      <div className="flex flex-wrap items-center gap-3 rounded-t-md border-b bg-muted/60 px-4 py-3">
        <span className="font-semibold">{STEPS[step]}</span>
        <span className="text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </span>
        <div className="ml-auto flex gap-1.5">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={cn("h-1.5 w-6 rounded-full", i <= step ? "bg-primary" : "bg-border")}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {step === 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              Pick the built-in standards packs for this repository. Packs are path-scoped — a pack
              only enters a review when matching files change — and every comment they drive cites
              the pack id.
            </p>
            <div>
              <label htmlFor="repo" className="text-sm font-semibold">
                Repository (for the generated file's header)
              </label>
              <Input
                id="repo"
                value={state.repo}
                onChange={(e) => patch({ repo: e.target.value })}
                placeholder="owner/name"
                className="mt-1 w-64"
              />
            </div>
            {packsQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading packs…</p>
            ) : packsQuery.isError ? (
              <p className="text-sm text-destructive">
                Could not load packs from /api/packs — is the Lanekeeper server running?
              </p>
            ) : (
              <div className="space-y-2">
                {packsQuery.data.map((pack) => {
                  const name = pack.id.replace(/^pack:/, "");
                  return (
                    <PackCard
                      key={pack.id}
                      pack={pack}
                      selected={state.packs.includes(name)}
                      onToggle={() => patch({ packs: toggle(state.packs, name) })}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground">
              Lanes decide how much human attention a change gets. Protected paths always require
              deep review, regardless of scores.
            </p>
            <div className="flex flex-wrap gap-6">
              <label className="text-sm">
                <span className="font-semibold">Auto lane max risk</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={cn(inputClass, "mt-1 block w-24")}
                  value={state.autoMaxRisk}
                  onChange={(e) => patch({ autoMaxRisk: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold">Fast lane max risk</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={cn(inputClass, "mt-1 block w-24")}
                  value={state.fastMaxRisk}
                  onChange={(e) => patch({ fastMaxRisk: Number(e.target.value) })}
                />
              </label>
            </div>
            <div>
              <p className="text-sm font-semibold">Auto-eligible categories</p>
              <p className="text-xs text-muted-foreground">
                Every category of a PR must be listed for it to qualify for the auto lane.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {CATEGORIES.map((category) => (
                  <CheckRow
                    key={category}
                    checked={state.autoCategories.includes(category)}
                    onChange={() =>
                      patch({ autoCategories: toggle(state.autoCategories, category) })
                    }
                  >
                    {category}
                  </CheckRow>
                ))}
              </div>
            </div>
            <label className="block text-sm">
              <span className="font-semibold">Protected paths</span> (one glob per line)
              <textarea
                className={cn(inputClass, "mt-1 block h-24 w-full py-1.5 font-mono text-xs")}
                value={state.protectedPaths}
                onChange={(e) => patch({ protectedPaths: e.target.value })}
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-muted-foreground">
              Sentinel re-examines what merged to the default branch with full-file context, and
              files evidence-verified findings as GitHub issues.
            </p>
            <CheckRow
              checked={state.sentinelEnabled}
              onChange={() => patch({ sentinelEnabled: !state.sentinelEnabled })}
            >
              <span className="font-semibold">Enable Sentinel post-merge scans</span>
            </CheckRow>
            <div className={cn("flex flex-wrap gap-6", !state.sentinelEnabled && "opacity-40")}>
              <label className="text-sm">
                <span className="font-semibold">Minimum severity to file</span>
                <select
                  className={cn(inputClass, "mt-1 block w-36")}
                  value={state.sentinelSeverity}
                  disabled={!state.sentinelEnabled}
                  onChange={(e) =>
                    patch({ sentinelSeverity: e.target.value as WizardState["sentinelSeverity"] })
                  }
                >
                  <option value="critical">critical</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="font-semibold">CLI lookback (hours)</span>
                <input
                  type="number"
                  min={1}
                  className={cn(inputClass, "mt-1 block w-24")}
                  value={state.sentinelWindow}
                  disabled={!state.sentinelEnabled}
                  onChange={(e) => patch({ sentinelWindow: Number(e.target.value) })}
                />
              </label>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-muted-foreground">
              Choose which events notify which platforms. Each platform also needs its webhook URL
              set on the server (<code>TEAMS_WEBHOOK_URL</code>, <code>SLACK_WEBHOOK_URL</code>,{" "}
              <code>DISCORD_WEBHOOK_URL</code>) — secrets stay in the environment, never in this
              file.
            </p>
            <div className="space-y-3">
              {LANE_EVENTS.map((lane) => (
                <div key={lane} className="flex items-center gap-4">
                  <span className="w-20 text-sm font-semibold capitalize">{lane}</span>
                  {PLATFORMS.map((platform) => (
                    <CheckRow
                      key={platform}
                      checked={state.notifications[lane].includes(platform)}
                      onChange={() =>
                        patch({
                          notifications: {
                            ...state.notifications,
                            [lane]: toggle(state.notifications[lane], platform),
                          },
                        })
                      }
                    >
                      {platform}
                    </CheckRow>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p className="text-sm text-muted-foreground">
              Commit this as <code>lanekeeper.yml</code> in{" "}
              <span className="font-semibold">{state.repo || "your repository"}</span>'s default
              branch — policy changes are pull requests like everything else. Lanekeeper picks it up
              on the next triage.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">lanekeeper.yml</span>
              <CopyButton text={buildPolicyYaml(state)} label="Copy" />
            </div>
            <pre className="overflow-x-auto rounded-md border bg-muted/60 p-3 text-xs leading-relaxed">
              {buildPolicyYaml(state)}
            </pre>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold">.lanekeeper/guidelines/team.md</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  optional starter for your own rules
                </span>
              </div>
              <CopyButton text={STARTER_GUIDELINE} label="Copy" />
            </div>
            <pre className="overflow-x-auto rounded-md border bg-muted/60 p-3 text-xs leading-relaxed">
              {STARTER_GUIDELINE}
            </pre>
          </>
        )}
      </div>

      <div className="flex items-center justify-between rounded-b-md border-t bg-muted/60 px-4 py-3">
        <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ChevronLeft className="size-3.5" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" onClick={() => setStep(step + 1)}>
            Next <ChevronRight className="size-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setState(INITIAL)}>
            Start over
          </Button>
        )}
      </div>
    </div>
  );
}
