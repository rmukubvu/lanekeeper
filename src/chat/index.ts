import type { AppConfig } from "../config.js";
import { DiscordAdapter } from "./discord.js";
import { SlackAdapter } from "./slack.js";
import { TeamsAdapter } from "./teams.js";
import type { ChangeCard, ChatAdapter } from "./types.js";

export function buildAdapters(config: AppConfig): ChatAdapter[] {
  const adapters: ChatAdapter[] = [];
  if (config.teamsWebhookUrl) adapters.push(new TeamsAdapter(config.teamsWebhookUrl));
  if (config.slackWebhookUrl) adapters.push(new SlackAdapter(config.slackWebhookUrl));
  if (config.discordWebhookUrl) adapters.push(new DiscordAdapter(config.discordWebhookUrl));
  return adapters;
}

/** Notify the adapters named by the policy; one platform failing must not block the rest. */
export async function notify(
  adapters: ChatAdapter[],
  targetNames: string[],
  card: ChangeCard,
): Promise<void> {
  const targets = adapters.filter((a) => targetNames.includes(a.name));
  const results = await Promise.allSettled(targets.map((a) => a.send(card)));
  for (const [i, result] of results.entries()) {
    if (result.status === "rejected") {
      console.warn(`notification via ${targets[i].name} failed:`, result.reason);
    }
  }
}
