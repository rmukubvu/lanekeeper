import fs from "node:fs";

// Load .env from the working directory into process.env (existing environment
// variables win). Every entry point goes through loadConfig, so this is the
// single place .env support lives.
try {
  process.loadEnvFile();
} catch {
  // no .env file — environment variables only
}

export type ProviderKind = "anthropic" | "openrouter" | "openai-compatible";

export interface AppConfig {
  port: number;
  dashboardPort: number;
  /** Base URL for GitHub Enterprise Server, e.g. https://github.example.com/api/v3 */
  githubApiUrl?: string;
  /** PAT for one-off CLI mode */
  githubToken?: string;
  /** GitHub App credentials for server mode */
  appId?: string;
  privateKey?: string;
  webhookSecret?: string;
  /** LLM backend */
  provider: ProviderKind;
  /** Model ID; provider-specific default applied in buildProvider */
  model?: string;
  /** Output-token cap for OpenAI-compatible providers (Anthropic uses tuned per-call limits) */
  maxOutputTokens: number;
  openrouterApiKey?: string;
  openrouterBaseUrl: string;
  openaiCompatBaseUrl?: string;
  openaiCompatApiKey?: string;
  /** Local fallback policy file, used when the target repo has no lanekeeper.yml */
  policyPath: string;
  /** Directory for the event log the dashboard reads */
  dataDir: string;
  teamsWebhookUrl?: string;
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
}

const PROVIDERS: ProviderKind[] = ["anthropic", "openrouter", "openai-compatible"];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const privateKey =
    env.GITHUB_APP_PRIVATE_KEY ??
    (env.GITHUB_APP_PRIVATE_KEY_PATH
      ? fs.readFileSync(env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8")
      : undefined);

  const provider = (env.LANEKEEPER_PROVIDER ?? "anthropic") as ProviderKind;
  if (!PROVIDERS.includes(provider)) {
    throw new Error(
      `Unknown LANEKEEPER_PROVIDER "${provider}" — expected one of: ${PROVIDERS.join(", ")}`,
    );
  }

  return {
    port: Number(env.PORT ?? 3000),
    dashboardPort: Number(env.DASHBOARD_PORT ?? 4400),
    githubApiUrl: env.GITHUB_API_URL,
    githubToken: env.GITHUB_TOKEN,
    appId: env.GITHUB_APP_ID,
    privateKey,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    provider,
    model: env.LANEKEEPER_MODEL,
    maxOutputTokens: Number(env.LANEKEEPER_MAX_OUTPUT_TOKENS ?? 8192),
    openrouterApiKey: env.OPENROUTER_API_KEY,
    openrouterBaseUrl: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    openaiCompatBaseUrl: env.OPENAI_COMPAT_BASE_URL,
    openaiCompatApiKey: env.OPENAI_COMPAT_API_KEY,
    policyPath: env.LANEKEEPER_POLICY ?? "lanekeeper.yml",
    dataDir: env.LANEKEEPER_DATA_DIR ?? ".lanekeeper",
    teamsWebhookUrl: env.TEAMS_WEBHOOK_URL,
    slackWebhookUrl: env.SLACK_WEBHOOK_URL,
    discordWebhookUrl: env.DISCORD_WEBHOOK_URL,
  };
}
