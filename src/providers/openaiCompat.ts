import { z } from "zod";
import { extractJson } from "./json.js";
import type { ModelProvider, StructuredParams, StructuredResult } from "./types.js";

export interface OpenAICompatOptions {
  name: string;
  /** e.g. https://openrouter.ai/api/v1 or http://localhost:11434/v1 (Ollama) */
  baseUrl: string;
  model: string;
  /** Optional — local servers usually need none */
  apiKey?: string;
  maxOutputTokens: number;
  extraHeaders?: Record<string, string>;
}

interface ChatCompletionResponse {
  choices?: {
    message?: { content?: string | null; refusal?: string | null };
    finish_reason?: string;
  }[];
}

const REQUEST_TIMEOUT_MS = 10 * 60_000; // local models can be slow

/**
 * Generic OpenAI-compatible chat/completions provider. One implementation
 * covers OpenRouter, Ollama, LM Studio, vLLM, and enterprise LLM gateways.
 *
 * Structured output strategy: ask for response_format json_schema AND embed
 * the schema in the prompt (weak models comply better with both). If the
 * server rejects response_format (400), retry once without it. Output is
 * always validated locally with zod — the caller's fail-safe handles misses.
 */
export class OpenAICompatProvider implements ModelProvider {
  readonly name: string;
  readonly model: string;

  constructor(private readonly options: OpenAICompatOptions) {
    this.name = options.name;
    this.model = options.model;
  }

  private async chat(body: Record<string, unknown>): Promise<ChatCompletionResponse> {
    const res = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        ...this.options.extraHeaders,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = new Error(`${this.name} request failed: ${res.status} ${detail.slice(0, 500)}`);
      (error as Error & { status?: number }).status = res.status;
      throw error;
    }
    return (await res.json()) as ChatCompletionResponse;
  }

  async structured<T>(
    schema: z.ZodType<T>,
    { system, user, schemaName }: StructuredParams,
  ): Promise<StructuredResult<T>> {
    const jsonSchema = z.toJSONSchema(schema);
    const prompt =
      `${user}\n\nRespond with ONLY a JSON object (no markdown fences, no commentary) ` +
      `that conforms to this JSON Schema:\n${JSON.stringify(jsonSchema)}`;

    const base = {
      model: this.model,
      max_tokens: this.options.maxOutputTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    };

    let response: ChatCompletionResponse;
    try {
      response = await this.chat({
        ...base,
        response_format: {
          type: "json_schema",
          json_schema: { name: schemaName, schema: jsonSchema },
        },
      });
    } catch (err) {
      // Some servers reject response_format entirely — fall back to prompt-only JSON.
      if ((err as { status?: number }).status === 400) {
        response = await this.chat(base);
      } else {
        throw err;
      }
    }

    const choice = response.choices?.[0];
    if (choice?.message?.refusal || choice?.finish_reason === "content_filter") {
      return { ok: false, reason: "model declined to assess this change" };
    }

    const raw = extractJson(choice?.message?.content ?? "");
    if (raw === undefined) {
      return { ok: false, reason: `no JSON found in ${this.name} response` };
    }
    const parsed = schema.safeParse(raw);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : {
          ok: false,
          reason: `response failed schema validation: ${parsed.error.issues[0]?.message ?? "unknown"}`,
        };
  }

  async text({ system, user }: { system: string; user: string }): Promise<{
    text: string;
    refused: boolean;
  }> {
    const response = await this.chat({
      model: this.model,
      max_tokens: this.options.maxOutputTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const choice = response.choices?.[0];
    return {
      text: choice?.message?.content ?? "",
      refused: Boolean(choice?.message?.refusal) || choice?.finish_reason === "content_filter",
    };
  }
}
