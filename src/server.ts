import http from "node:http";
import { App, createNodeMiddleware, Octokit } from "octokit";
import { buildAdapters } from "./chat/index.js";
import { loadConfig } from "./config.js";
import { handleDashboard } from "./dashboard.js";
import { runPipeline } from "./pipeline.js";
import { buildProvider } from "./providers/index.js";
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
