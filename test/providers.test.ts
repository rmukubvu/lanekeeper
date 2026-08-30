import { describe, expect, it } from "vitest";
import { extractJson } from "../src/providers/json.js";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON with a language tag", () => {
    expect(extractJson('Here you go:\n```json\n{"a": 1}\n```\nDone.')).toEqual({ a: 1 });
  });

  it("parses fenced JSON without a language tag", () => {
    expect(extractJson('```\n{"a": [1, 2]}\n```')).toEqual({ a: [1, 2] });
  });

  it("recovers an embedded object surrounded by commentary", () => {
    expect(
      extractJson('Sure! The assessment is {"risk": 40, "lane": "fast"} — let me know.'),
    ).toEqual({
      risk: 40,
      lane: "fast",
    });
  });

  it("returns undefined when there is no JSON", () => {
    expect(extractJson("I cannot help with that.")).toBeUndefined();
  });
});
