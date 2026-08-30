import type { ChangeCard, ChatAdapter } from "./types.js";

/** Slack adapter: Block Kit via an incoming webhook. */
export class SlackAdapter implements ChatAdapter {
  readonly name = "slack";

  constructor(private readonly webhookUrl: string) {}

  async send(card: ChangeCard): Promise<void> {
    const emoji = card.severity === "critical" ? "🔴" : card.severity === "attention" ? "🟠" : "🟢";

    const blocks: unknown[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `${emoji} ${card.title}`.slice(0, 150), emoji: true },
      },
      ...(card.subtitle
        ? [{ type: "context", elements: [{ type: "mrkdwn", text: card.subtitle }] }]
        : []),
      {
        type: "section",
        fields: card.facts.map((f) => ({ type: "mrkdwn", text: `*${f.label}:*\n${f.value}` })),
      },
      ...(card.body ? [{ type: "section", text: { type: "mrkdwn", text: card.body } }] : []),
      { type: "context", elements: [{ type: "mrkdwn", text: `<${card.url}|Open pull request>` }] },
    ];

    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: card.title, blocks }),
    });
    if (!res.ok) {
      throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
    }
  }
}
