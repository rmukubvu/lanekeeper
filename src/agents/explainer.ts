import type { ModelProvider } from "../providers/types.js";
import { renderFacts } from "../render.js";
import type { PRFacts } from "../types.js";

const SYSTEM = `You write guided walkthroughs of large pull requests so a human can review with judgment instead of scrolling a wall of diff. The PRs are often AI-generated and bigger than anyone wants to read line by line.

Structure the walkthrough as semantic layers in the order a reviewer should read them:
1. Contracts & schemas — interfaces, types, API shapes, migrations, config
2. Core logic — the essential behavior change
3. Integration points — call sites, wiring, feature flags
4. Tests — what is and is not covered
5. Docs & chores — everything mechanical

Start with a short "Intent" paragraph (what this PR is trying to do and how the pieces fit), then one section per non-empty layer. In each section: which files belong to it (cite as \`path\`), what changed, the specific risks, and what the reviewer should verify. Skip empty layers. End with "What I could not verify" if the diff was truncated or context is missing.

Output GitHub-flavored markdown starting with a "## 🛣️ Guided walkthrough" heading. Be concrete and terse — no filler, no praise, no restating the diff.`;

export async function generateWalkthrough(
  provider: ModelProvider,
  facts: PRFacts,
): Promise<string> {
  const { text, refused } = await provider.text({ system: SYSTEM, user: renderFacts(facts) });
  if (refused || !text.trim()) {
    return "## 🛣️ Guided walkthrough\n\nThe model declined to analyze this change — please review manually.";
  }
  return text;
}
