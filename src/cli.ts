import { parseArgs } from "node:util";
import { buildAdapters } from "./chat/index.js";
import { loadConfig } from "./config.js";
import { tokenOctokit } from "./github.js";
import { runPipeline } from "./pipeline.js";
import { buildProvider } from "./providers/index.js";
import { EventStore } from "./store.js";

const { values } = parseArgs({
  options: {
    repo: { type: "string" },
    pr: { type: "string" },
    post: { type: "boolean", default: false },
  },
});

if (!values.repo?.includes("/") || !values.pr) {
  console.error("Usage: npm run triage -- --repo owner/name --pr 123 [--post]");
  console.error("Without --post this is a dry run: nothing is written to the PR or chat.");
  process.exit(1);
}

const config = loadConfig();
if (!config.githubToken) {
  console.error("Set GITHUB_TOKEN (a PAT with repo read access; write access if using --post).");
  process.exit(1);
}

const [owner, repo] = values.repo.split("/");
const number = Number(values.pr);

const provider = buildProvider(config);
console.error(`triaging ${owner}/${repo}#${number} with ${provider.model} via ${provider.name}...`);

const result = await runPipeline({
  octokit: tokenOctokit(config),
  provider,
  config,
  adapters: buildAdapters(config),
  store: new EventStore(config.dataDir),
  owner,
  repo,
  number,
  post: values.post,
});

console.log(`\n${"=".repeat(72)}`);
console.log(result.scorecard);
console.log("=".repeat(72));
console.log("\nDecision:", JSON.stringify(result.decision, null, 2));
if (result.walkthrough) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(result.walkthrough);
  console.log("=".repeat(72));
}
if (!values.post) {
  console.log("\n(dry run — pass --post to write the scorecard/labels to the PR and notify chat)");
  console.log("(recorded for the dashboard: npm run dashboard)");
}
