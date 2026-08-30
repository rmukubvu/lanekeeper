/**
 * Best-effort JSON extraction from model output. Local and routed models often
 * wrap JSON in markdown fences or add commentary despite instructions.
 */
export function extractJson(text: string): unknown {
  const candidates: (string | undefined)[] = [];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  candidates.push(fenced?.[1]);

  candidates.push(text);

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    candidates.push(text.slice(first, last + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate.trim());
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}
