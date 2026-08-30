import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minimatch } from "minimatch";
import type { Octokit } from "octokit";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { Policy } from "./policy.js";

export type AgentKind = "triage" | "inline" | "sentinel";
const AGENTS: AgentKind[] = ["triage", "inline", "sentinel"];

export interface Guideline {
  /** e.g. "pack:effective-go", "org:security-baseline", "repo:error-handling" */
  id: string;
  title: string;
  /** Globs the changed files must match; empty = applies to everything */
  paths: string[];
  appliesTo: AgentKind[];
  body: string;
}

const FrontmatterSchema = z.object({
  title: z.string().optional(),
  paths: z.array(z.string()).default([]),
  applies_to: z.array(z.enum(["triage", "inline", "sentinel"])).default([...AGENTS]),
});

const PACKS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../guidelines/packs");
const MAX_GUIDELINE_FILES = 20;

/** Source rank decides what survives the injection budget: repo > org > pack. */
function sourceRank(id: string): number {
  if (id.startsWith("repo:")) return 0;
  if (id.startsWith("org:")) return 1;
  return 2;
}

export function parseGuidelineFile(id: string, raw: string): Guideline {
  let meta: z.infer<typeof FrontmatterSchema> = FrontmatterSchema.parse({});
  let body = raw.trim();

  if (raw.startsWith("---\n")) {
    const end = raw.indexOf("\n---\n", 4);
    if (end > 0) {
      meta = FrontmatterSchema.parse(parseYaml(raw.slice(4, end)) ?? {});
      body = raw.slice(end + 5).trim();
    }
  }

  return {
    id,
    title: meta.title ?? id.split(":")[1] ?? id,
    paths: meta.paths,
    appliesTo: meta.applies_to,
    body,
  };
}

/** All bundled packs, for the dashboard's setup wizard and pack discovery. */
export function listAvailablePacks(): Guideline[] {
  if (!fs.existsSync(PACKS_DIR)) return [];
  return fs
    .readdirSync(PACKS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) =>
      parseGuidelineFile(
        `pack:${f.replace(/\.md$/, "")}`,
        fs.readFileSync(path.join(PACKS_DIR, f), "utf8"),
      ),
    );
}

export function loadPackGuidelines(packNames: string[]): Guideline[] {
  const guidelines: Guideline[] = [];
  for (const name of packNames) {
    const file = path.join(PACKS_DIR, `${name}.md`);
    if (!fs.existsSync(file)) {
      const available = fs.existsSync(PACKS_DIR)
        ? fs
            .readdirSync(PACKS_DIR)
            .filter((f) => f.endsWith(".md"))
            .map((f) => f.replace(/\.md$/, ""))
            .join(", ")
        : "(none)";
      console.warn(`unknown guideline pack "${name}" — available: ${available}`);
      continue;
    }
    guidelines.push(parseGuidelineFile(`pack:${name}`, fs.readFileSync(file, "utf8")));
  }
  return guidelines;
}

async function fetchGuidelinesDir(
  octokit: Octokit,
  owner: string,
  repo: string,
  dirPath: string,
  idPrefix: string,
): Promise<Guideline[]> {
  const guidelines: Guideline[] = [];
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path: dirPath });
    if (!Array.isArray(data)) return [];
    const files = data.filter((e) => e.type === "file" && e.name.endsWith(".md"));
    for (const entry of files.slice(0, MAX_GUIDELINE_FILES)) {
      const { data: file } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: entry.path,
      });
      if (!Array.isArray(file) && file.type === "file" && "content" in file) {
        const raw = Buffer.from(file.content, "base64").toString("utf8");
        const name = entry.name.replace(/\.md$/, "");
        guidelines.push(parseGuidelineFile(`${idPrefix}:${name}`, raw));
      }
    }
  } catch {
    // no guidelines directory — that's the common case
  }
  return guidelines;
}

/**
 * Resolve all guideline layers for a target repository, in budget-priority
 * order is applied later; here we just gather: built-in packs (policy-named),
 * the org baseline repo, and the target repo's own .lanekeeper/guidelines/.
 */
export async function resolveGuidelines(
  octokit: Octokit,
  owner: string,
  repo: string,
  policy: Policy,
): Promise<Guideline[]> {
  if (!policy.guidelines.enabled) return [];

  const all: Guideline[] = [...loadPackGuidelines(policy.guidelines.packs)];

  if (policy.guidelines.org_repo.includes("/")) {
    const [orgOwner, orgRepo] = policy.guidelines.org_repo.split("/");
    all.push(...(await fetchGuidelinesDir(octokit, orgOwner, orgRepo, "guidelines", "org")));
  }

  all.push(...(await fetchGuidelinesDir(octokit, owner, repo, ".lanekeeper/guidelines", "repo")));
  return all;
}

export interface GuidelineSelection {
  /** Prompt block to append to the agent's input; undefined when nothing applies */
  text?: string;
  /** Ids that made it into the block, for traceability */
  used: string[];
  truncated: boolean;
}

/**
 * Pick the guidelines relevant to this run: right agent, matching at least one
 * changed file, fitted into the character budget with repo > org > pack
 * priority. Injected as data alongside the diff, with a citation instruction.
 */
export function selectGuidelines(
  guidelines: Guideline[],
  changedPaths: string[],
  agent: AgentKind,
  maxChars: number,
): GuidelineSelection {
  const applicable = guidelines
    .filter((g) => g.appliesTo.includes(agent))
    .filter(
      (g) =>
        g.paths.length === 0 ||
        changedPaths.some((p) => g.paths.some((glob) => minimatch(p, glob, { dot: true }))),
    )
    .sort((a, b) => sourceRank(a.id) - sourceRank(b.id));

  if (applicable.length === 0) return { used: [], truncated: false };

  const header =
    "## Team & organization review guidelines\n" +
    "Apply these standards where relevant. When a score, comment, finding, or suggestion is " +
    "driven by one of them, cite its id in square brackets, e.g. [repo:error-handling].\n";

  let budget = maxChars;
  const sections: string[] = [];
  const used: string[] = [];
  let truncated = false;

  for (const guideline of applicable) {
    const section = `\n### [${guideline.id}] ${guideline.title}\n${guideline.body}\n`;
    if (section.length > budget) {
      truncated = true;
      continue;
    }
    sections.push(section);
    used.push(guideline.id);
    budget -= section.length;
  }

  if (used.length === 0) return { used: [], truncated };
  return { text: header + sections.join(""), used, truncated };
}
