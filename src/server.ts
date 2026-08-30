import http from "node:http";
import { App, createNodeMiddleware, Octokit } from "octokit";
import { buildAdapters } from "./chat/index.js";
import { loadConfig } from "./config.js";
import { handleDashboard } from "./dashboard.js";
import { resolvePolicy, runPipeline } from "./pipeline.js";
import { buildProvider } from "./providers/index.js";
import { runSentinel } from "./sentinel.js";
import { EventStore } from "./store.js";

const config = loadConfig();

if (!config.appId || !config.privateKey || !config.webhookSecret) {
  console.error(
    "Server mode needs GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY(_PATH), and GITHUB_WEBHOOK_SECRET.\n" +
      "For a one-off run against a single PR, use: npm run triage -- --repo owner/name --pr 123",
  );
  process.exit(1);
}

const app = new App({
  appId: config.appId,
  privateKey: config.privateKey,
  webhooks: { secret: config.webhookSecret },
  ...(config.githubApiUrl ? { Octokit: Octokit.defaults({ baseUrl: config.githubApiUrl }) } : {}),
});

const provider = buildProvider(config);
const adapters = buildAdapters(config);
const store = new EventStore(config.dataDir);

app.webhooks.on(
  [
    "pull_request.opened",
    "pull_request.reopened",
    "pull_request.synchronize",
    "pull_request.ready_for_review",
  ],
  async ({ octokit, payload }) => {
    if (payload.pull_request.draft) return;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const number = payload.pull_request.number;
    console.log(`triaging ${owner}/${repo}#${number} (${payload.action})`);
    try {
      const result = await runPipeline({
        octokit: octokit as unknown as Octokit,
        provider,
        config,
        adapters,
        store,
        owner,
        repo,
        number,
        post: true,
      });
      console.log(
        `${owner}/${repo}#${number} → lane=${result.decision.lane} risk=${result.assessment.risk_score}`,
      );
    } catch (err) {
      console.error(`pipeline failed for ${owner}/${repo}#${number}:`, err);
    }
  },
);

// Post-merge: every push to the default branch gets a Sentinel security scan
// of exactly that commit range, opening deduplicated issues for findings.
app.webhooks.on("push", async ({ octokit, payload }) => {
  const branch = payload.ref.replace("refs/heads/", "");
  if (branch !== payload.repository.default_branch) return;
  if (payload.before.startsWith("0000000")) return; // branch creation, no range
  const owner = payload.repository.owner?.login ?? payload.repository.owner?.name ?? "";
  const repo = payload.repository.name;
  if (!owner) return;
  try {
    const policy = await resolvePolicy(
      octokit as unknown as Octokit,
      owner,
      repo,
      config.policyPath,
    );
    if (!policy.sentinel.enabled) return;
    console.log(
      `sentinel scanning ${owner}/${repo} ${payload.before.slice(0, 8)}...${payload.after.slice(0, 8)}`,
    );
    const result = await runSentinel({
      octokit: octokit as unknown as Octokit,
      provider,
      policy,
      adapters,
      owner,
      repo,
      basehead: `${payload.before}...${payload.after}`,
      post: true,
    });
    console.log(
      `sentinel ${owner}/${repo}: ${result.findings.length} finding(s), ${result.issues?.opened ?? 0} issue(s) opened`,
    );
  } catch (err) {
    console.error(`sentinel failed for ${owner}/${repo}:`, err);
  }
});

app.webhooks.onError((err) => console.error("webhook error:", err));

const middleware = createNodeMiddleware(app);

http
  .createServer(async (req, res) => {
    if (await middleware(req, res)) return;
    if (handleDashboard(req, res, store)) return;
    res.writeHead(404).end();
  })
  .listen(config.port, () => {
    console.log(
      `lanekeeper listening on :${config.port} (webhooks at /api/github/webhooks, dashboard at /)`,
    );
    console.log(`model: ${provider.model} via ${provider.name}`);
    console.log(`chat adapters: ${adapters.map((a) => a.name).join(", ") || "none configured"}`);
  });
