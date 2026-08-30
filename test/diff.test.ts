import { describe, expect, it } from "vitest";
import { anchorInlineComments, annotatePatch, parsePatchNewLines } from "../src/diff.js";
import type { ChangedFile } from "../src/types.js";

const PATCH = [
  "@@ -1,4 +1,5 @@",
  " line one",
  "-old two",
  "+new two",
  "+added three",
  " line four",
  "@@ -10,3 +11,3 @@",
  " ten",
  "-eleven",
  "+ELEVEN",
  " twelve",
].join("\n");

const FILE: ChangedFile = {
  path: "src/example.ts",
  status: "modified",
  additions: 3,
  deletions: 2,
  patch: PATCH,
};

const MARKER = "<!-- lanekeeper:inline -->";

function proposal(overrides: Partial<Parameters<typeof anchorInlineComments>[1][number]> = {}) {
  return {
    path: "src/example.ts",
    line: 2,
    start_line: 0,
    original: "new two",
    body: "Explain the fix.",
    suggestion: "better two",
    ...overrides,
  };
}

describe("parsePatchNewLines", () => {
  it("maps RIGHT-side lines to new-file line numbers across hunks", () => {
    const map = parsePatchNewLines(PATCH);
    expect(map.get(1)).toEqual({ content: "line one", kind: "context" });
    expect(map.get(2)).toEqual({ content: "new two", kind: "added" });
    expect(map.get(3)).toEqual({ content: "added three", kind: "added" });
    expect(map.get(4)).toEqual({ content: "line four", kind: "context" });
    expect(map.get(11)).toEqual({ content: "ten", kind: "context" });
    expect(map.get(12)).toEqual({ content: "ELEVEN", kind: "added" });
    expect(map.get(13)).toEqual({ content: "twelve", kind: "context" });
    expect(map.has(5)).toBe(false); // hunk gap is not commentable
  });

  it("stops at truncation sentinels", () => {
    const map = parsePatchNewLines(`${PATCH}\n... (patch truncated)\n+phantom`);
    expect([...map.values()].some((l) => l.content === "phantom")).toBe(false);
  });
});

describe("annotatePatch", () => {
  it("numbers only RIGHT-side lines", () => {
    const annotated = annotatePatch(PATCH).split("\n");
    expect(annotated[1]).toBe("    1  line one");
    expect(annotated[2]).toBe("      -old two");
    expect(annotated[3]).toBe("    2 +new two");
    expect(annotated[8]).toBe("      -eleven");
    expect(annotated[9]).toBe("   12 +ELEVEN");
  });
});

describe("anchorInlineComments", () => {
  it("accepts a correctly anchored comment and appends the suggestion fence", () => {
    const { comments, dropped } = anchorInlineComments([FILE], [proposal()], 6, MARKER);
    expect(dropped).toBe(0);
    expect(comments).toHaveLength(1);
    expect(comments[0].line).toBe(2);
    expect(comments[0].body).toContain("```suggestion\nbetter two\n```");
    expect(comments[0].body).toContain(MARKER);
  });

  it("re-anchors a single-line comment when the line number drifted but content is unique", () => {
    const { comments } = anchorInlineComments([FILE], [proposal({ line: 7 })], 6, MARKER);
    expect(comments).toHaveLength(1);
    expect(comments[0].line).toBe(2);
  });

  it("drops comments whose content cannot be located", () => {
    const { comments, dropped } = anchorInlineComments(
      [FILE],
      [proposal({ original: "not in the diff" })],
      6,
      MARKER,
    );
    expect(comments).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("drops multi-line ranges that span a hunk gap", () => {
    const bad = proposal({ start_line: 4, line: 11, original: "ten" });
    const { comments, dropped } = anchorInlineComments([FILE], [bad], 6, MARKER);
    expect(comments).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("accepts contiguous multi-line ranges", () => {
    const good = proposal({ start_line: 2, line: 3, original: "added three", suggestion: "a\nb" });
    const { comments } = anchorInlineComments([FILE], [good], 6, MARKER);
    expect(comments).toHaveLength(1);
    expect(comments[0].start_line).toBe(2);
    expect(comments[0].line).toBe(3);
  });

  it("caps the number of comments and counts the overflow as dropped", () => {
    const many = [proposal(), proposal({ line: 3, original: "added three" })];
    const { comments, dropped } = anchorInlineComments([FILE], many, 1, MARKER);
    expect(comments).toHaveLength(1);
    expect(dropped).toBe(1);
  });

  it("uses a longer fence when the suggestion contains backticks", () => {
    const { comments } = anchorInlineComments(
      [FILE],
      [proposal({ suggestion: "const s = `a ``` b`;" })],
      6,
      MARKER,
    );
    expect(comments[0].body).toContain("````suggestion");
  });
});
