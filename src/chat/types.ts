export type Severity = "info" | "attention" | "critical";

export interface CardFact {
  label: string;
  value: string;
}

/**
 * Platform-neutral notification card. Each adapter renders it into its
 * platform's native format (Adaptive Card, Block Kit, embed). Adding a new
 * chat platform means implementing ChatAdapter — nothing else changes.
 */
export interface ChangeCard {
  title: string;
  subtitle?: string;
  url: string;
  facts: CardFact[];
  body?: string;
  severity: Severity;
}

export interface ChatAdapter {
  readonly name: string;
  send(card: ChangeCard): Promise<void>;
}
