import type { AppConfig } from "../config.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAICompatProvider } from "./openaiCompat.js";
import type { ModelProvider } from "./types.js";

export type { ModelProvider, StructuredParams, StructuredResult } from "./types.js";

export function buildProvider(config: AppConfig): ModelProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config.model ?? "claude-opus-5");

    case "openrouter": {
      if (!config.openrouterApiKey) {
        throw new Error("LANEKEEPER_PROVIDER=openrouter requires OPENROUTER_API_KEY");
      }
      return new OpenAICompatProvider({
        name: "openrouter",
        baseUrl: config.openrouterBaseUrl,
        // OpenRouter namespaces models by vendor.
        model: config.model ?? "anthropic/claude-opus-5",
        apiKey: config.openrouterApiKey,
        maxOutputTokens: config.maxOutputTokens,
        extraHeaders: { "X-Title": "Lanekeeper" },
      });
    }

    case "openai-compatible": {
      if (!config.openaiCompatBaseUrl) {
        throw new Error(
          "LANEKEEPER_PROVIDER=openai-compatible requires OPENAI_COMPAT_BASE_URL " +
            "(e.g. http://localhost:11434/v1 for Ollama)",
        );
      }
      if (!config.model) {
        throw new Error(
          "LANEKEEPER_PROVIDER=openai-compatible requires LANEKEEPER_MODEL " +
            "(the model name your server exposes, e.g. qwen3:32b)",
        );
      }
      return new OpenAICompatProvider({
        name: "openai-compatible",
        baseUrl: config.openaiCompatBaseUrl,
        model: config.model,
        apiKey: config.openaiCompatApiKey,
        maxOutputTokens: config.maxOutputTokens,
      });
    }
  }
}
