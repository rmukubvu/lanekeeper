import type { ChangeCard, ChatAdapter } from "./types.js";

/** Discord adapter: embed via a channel webhook. */
export class DiscordAdapter implements ChatAdapter {
  readonly name = "discord";

  constructor(private readonly webhookUrl: string) {}

  async send(card: ChangeCard): Promise<void> {
    const color =
      card.severity === "critical" ? 0xd83b01 : card.severity === "attention" ? 0xf2c744 : 0x36a64f;

    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: card.title.slice(0, 256),
            url: card.url,
            description: [card.subtitle, card.body].filter(Boolean).join("\n\n").slice(0, 4000),
            color,
            fields: card.facts.map((f) => ({ name: f.label, value: f.value, inline: true })),
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
    }
  }
}
