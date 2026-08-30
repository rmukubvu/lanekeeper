import { describe, expect, it } from "vitest";
import {
  type Guideline,
  loadPackGuidelines,
  parseGuidelineFile,
  selectGuidelines,
} from "../src/guidelines.js";

function guideline(overrides: Partial<Guideline> = {}): Guideline {
  return {
    id: "repo:errors",
    title: "Error handling",
    paths: ["**/*.go"],
    appliesTo: ["triage", "inline", "sentinel"],
    body: "- Wrap errors with %w.",
    ...overrides,
  };
}

describe("parseGuidelineFile", () => {
  it("parses frontmatter for paths, agents, and title", () => {
    const parsed = parseGuidelineFile(
      "repo:java-style",
      "---\ntitle: Java style\npaths: ['**/*.java']\napplies_to: [inline]\n---\n- Use builders.\n",
    );
    expect(parsed.title).toBe("Java style");
    expect(parsed.paths).toEqual(["**/*.java"]);
    expect(parsed.appliesTo).toEqual(["inline"]);
    expect(parsed.body).toBe("- Use builders.");
  });

  it("defaults to all paths and all agents without frontmatter", () => {
    const parsed = parseGuidelineFile("repo:general", "- Be kind to reviewers.");
    expect(parsed.paths).toEqual([]);
    expect(parsed.appliesTo).toEqual(["triage", "inline", "sentinel"]);
    expect(parsed.title).toBe("general");
    expect(parsed.body).toBe("- Be kind to reviewers.");
  });
});

describe("loadPackGuidelines", () => {
  it("loads bundled packs with their path scopes", () => {
    const packs = loadPackGuidelines(["effective-go", "react-hooks"]);
    expect(packs.map((p) => p.id)).toEqual(["pack:effective-go", "pack:react-hooks"]);
    expect(packs[0].paths).toEqual(["**/*.go"]);
    expect(packs[0].body).toContain("errors.Is");
  });

  it("skips unknown packs instead of failing", () => {
    expect(loadPackGuidelines(["does-not-exist"])).toEqual([]);
  });
});

describe("selectGuidelines", () => {
  it("includes only guidelines matching the changed files and agent", () => {
    const all = [
      guideline({ id: "repo:go", paths: ["**/*.go"] }),
      guideline({ id: "repo:java", paths: ["**/*.java"] }),
      guideline({ id: "repo:inline-only", paths: [], appliesTo: ["inline"] }),
    ];
    const selection = selectGuidelines(all, ["src/main.go"], "triage", 6000);
    expect(selection.used).toEqual(["repo:go"]);
    expect(selection.text).toContain("[repo:go]");
    expect(selection.text).toContain("cite its id");
  });

  it("applies path-less guidelines to everything", () => {
    const selection = selectGuidelines(
      [guideline({ paths: [] })],
      ["docs/readme.md"],
      "sentinel",
      6000,
    );
    expect(selection.used).toEqual(["repo:errors"]);
  });

  it("returns no text when nothing applies", () => {
    const selection = selectGuidelines([guideline()], ["docs/readme.md"], "triage", 6000);
    expect(selection.text).toBeUndefined();
    expect(selection.used).toEqual([]);
  });

  it("prioritizes repo over org over pack under a tight budget", () => {
    const big = "x".repeat(200);
    const all = [
      guideline({ id: "pack:one", body: big, paths: [] }),
      guideline({ id: "org:two", body: big, paths: [] }),
      guideline({ id: "repo:three", body: big, paths: [] }),
    ];
    const selection = selectGuidelines(all, ["a.go"], "triage", 400);
    expect(selection.used).toEqual(["repo:three"]);
    expect(selection.truncated).toBe(true);
  });
});
