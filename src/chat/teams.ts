import type { ChangeCard, ChatAdapter } from "./types.js";

/**
 * Microsoft Teams adapter. Posts an Adaptive Card via a Teams "Workflows"
 * (Power Automate) incoming webhook — the successor to the retired Office 365
 * connectors. Create one in Teams: channel → Workflows → "Post to a channel
 * when a webhook request is received", then put the URL in TEAMS_WEBHOOK_URL.
 */
export class TeamsAdapter implements ChatAdapter {
  readonly name = "teams";

  constructor(private readonly webhookUrl: string) {}

  async send(card: ChangeCard): Promise<void> {
    const color =
      card.severity === "critical"
        ? "Attention"
        : card.severity === "attention"
          ? "Warning"
          : "Default";

    const adaptiveCard = {
      type: "AdaptiveCard",
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      version: "1.4",
      body: [
        { type: "TextBlock", size: "Large", weight: "Bolder", color, text: card.title, wrap: true },
        ...(card.subtitle
          ? [{ type: "TextBlock", text: card.subtitle, isSubtle: true, wrap: true }]
          : []),
        { type: "FactSet", facts: card.facts.map((f) => ({ title: f.label, value: f.value })) },
        ...(card.body ? [{ type: "TextBlock", text: card.body, wrap: true }] : []),
      ],
      actions: [{ type: "Action.OpenUrl", title: "Open pull request", url: card.url }],
    };

    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            contentUrl: null,
            content: adaptiveCard,
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Teams webhook failed: ${res.status} ${await res.text()}`);
    }
  }
}
