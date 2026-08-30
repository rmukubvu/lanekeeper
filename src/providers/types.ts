import type { z } from "zod";

export interface StructuredParams {
  system: string;
  user: string;
  /** Identifier for the schema, required by OpenAI-style response_format */
  schemaName: string;
}

export type StructuredResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Abstraction over LLM backends. Lanekeeper needs exactly two capabilities:
 * a schema-validated structured call (triage) and a long-form text call
 * (walkthroughs). Anything that can do both can power the pipeline.
 */
export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  structured<T>(schema: z.ZodType<T>, params: StructuredParams): Promise<StructuredResult<T>>;
  text(params: { system: string; user: string }): Promise<{ text: string; refused: boolean }>;
}
