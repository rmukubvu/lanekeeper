import { parseArgs } from "node:util";
import { buildAdapters } from "./chat/index.js";
import { loadConfig } from "./config.js";
import { tokenOctokit } from "./github.js";
import { resolvePolicy } from "./pipeline.js";
import { buildProvider } from "./providers/index.js";
import { runSentinel } from "./sentinel.js";

const { values } = parseArgs({
  options: {
    repo: { type: "string" },
    since: { type: "string" },
    post: { type: "boolean", default: false },
  },
});

if (!values.repo?.includes("/")) {
  console.error("Usage: npm run sentinel -- --repo owner/name [--since <hours>] [--post]");
  console.error(
    "Scans changes merged to the default branch in the window (default: policy sentinel.window_hours).",
  );
  console.error("Without --post this is a dry run: no issues are opened, no chat is notified.");
  process.exit(1);
}

const config = loadConfig();
if (!config.githubToken) {
  console.error(
    "Set GITHUB_TOKEN (a PAT with repo read access; issues write access if using --post).",
  );
  process.exit(1);
}

const [owner, repo] = values.repo.split("/");
const octokit = tokenOctokit(config);
const provider = buildProvider(config);
const policy = await resolvePolicy(octokit, owner, repo, config.policyPath);

const hours = values.since ? Number(values.since) : policy.sentinel.window_hours;
const since = new Date(Date.now() - hours * 3_600_000).toISOString();

console.error(
  `sentinel scanning ${owner}/${repo} (last ${hours}h) with ${provider.model} via ${provider.name}...`,
);

const result = await runSentinel({
  octokit,
  provider,
  policy,
  adapters: buildAdapters(config),
  owner,
  repo,
  since,
  post: values.post,
});

console.log(`\n${"=".repeat(72)}`);
console.log(
  `Scanned ${result.scanned.base.slice(0, 8)}...${result.scanned.head.slice(0, 8)} — ${result.scanned.commits} commit(s), ${result.scanned.files} file(s)`,
);
console.log(
  `Findings: ${result.findings.length} verified · ${result.droppedUnverified} dropped (evidence not found) · ${result.belowSeverity} below min severity`,
);

for (const finding of result.findings) {
  console.log(`\n--- [${finding.severity}/${finding.confidence}] ${finding.title}`);
  console.log(`    ${finding.file} · ${finding.category.replace("_", " ")}`);
  console.log(`    Evidence: ${finding.evidence.trim().split("\n")[0].slice(0, 100)}`);
  console.log(`    Why: ${finding.explanation}`);
  console.log(`    Fix: ${finding.recommendation}`);
}

if (result.issues) {
  console.log(
    `\nOpened ${result.issues.opened} issue(s); ${result.issues.skippedExisting} already tracked`,
  );
  for (const url of result.issues.urls) console.log(`  ${url}`);
} else if (!values.post && result.findings.length > 0) {
  console.log("\n(dry run — pass --post to open GitHub issues and notify chat)");
}
console.log("=".repeat(72));
