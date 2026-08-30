import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { ModelProvider, StructuredParams, StructuredResult } from "./types.js";

/**
 * Default provider: the Claude API via the official SDK, with native
 * structured outputs (server-validated against the schema) and streaming for
 * long walkthroughs. Credentials come from ANTHROPIC_API_KEY or an
 * `ant auth login` profile.
 */
export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(readonly model: string) {
    this.client = new Anthropic();
  }

  async structured<T>(
    schema: z.ZodType<T>,
    { system, user }: StructuredParams,
  ): Promise<StructuredResult<T>> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(schema) },
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "model declined to assess this change" };
    }
    return response.parsed_output != null
      ? { ok: true, value: response.parsed_output }
      : { ok: false, reason: "structured output could not be parsed" };
  }

  async text({ system, user }: { system: string; user: string }): Promise<{
    text: string;
    refused: boolean;
  }> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 64000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const message = await stream.finalMessage();
    return {
      refused: message.stop_reason === "refusal",
      text: message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n"),
    };
  }
}
