import type { ChangedFile } from "./types.js";

export interface DiffLine {
  content: string;
  kind: "added" | "context";
}

/** New-file line number → line, for every RIGHT-side (commentable) line in a patch. */
export type NewLineMap = Map<number, DiffLine>;

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parsePatchNewLines(patch: string): NewLineMap {
  const map: NewLineMap = new Map();
  let newLine = 0;
  let inHunk = false;

  for (const raw of patch.split("\n")) {
    const hunk = raw.match(HUNK_HEADER);
    if (hunk) {
      newLine = Number(hunk[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;

    if (raw.startsWith("+")) {
      map.set(newLine, { content: raw.slice(1), kind: "added" });
      newLine += 1;
    } else if (raw.startsWith(" ")) {
      map.set(newLine, { content: raw.slice(1), kind: "context" });
      newLine += 1;
    } else if (raw.startsWith("-") || raw.startsWith("\\")) {
      // old-side line / "no newline" marker — not commentable on RIGHT
    } else {
      // anything else (truncation sentinel, trailing noise) ends the hunk
      inHunk = false;
    }
  }
  return map;
}

/**
 * Prefix each RIGHT-side diff line with its real new-file line number so the
 * model can reference lines it is allowed to comment on. Old-side lines get
 * blank gutters.
 */
export function annotatePatch(patch: string): string {
  const out: string[] = [];
  let newLine = 0;
  let inHunk = false;

  for (const raw of patch.split("\n")) {
    const hunk = raw.match(HUNK_HEADER);
    if (hunk) {
      newLine = Number(hunk[1]);
      inHunk = true;
      out.push(raw);
      continue;
    }
    if (inHunk && (raw.startsWith("+") || raw.startsWith(" "))) {
      out.push(`${String(newLine).padStart(5)} ${raw}`);
      newLine += 1;
    } else {
      if (inHunk && !raw.startsWith("-") && !raw.startsWith("\\")) inHunk = false;
      out.push(`      ${raw}`);
    }
  }
  return out.join("\n");
}

/** What the inline-reviewer model proposes (unvalidated). */
export interface RawInlineComment {
  path: string;
  line: number;
  /** 0 = single-line comment; otherwise first line of a multi-line range */
  start_line: number;
  /** Exact content of the line at `line`, used to verify the anchor */
  original: string;
  body: string;
  /** Complete replacement for the range; empty = comment without a code fix */
  suggestion: string;
}

export interface AnchoredComment {
  path: string;
  line: number;
  start_line?: number;
  body: string;
}

function fenceSuggestion(suggestion: string): string {
  const fence = suggestion.includes("```") ? "````" : "```";
  return `\n\n${fence}suggestion\n${suggestion}\n${fence}`;
}

const trimEq = (a: string, b: string) => a.trim() === b.trim();

/**
 * Deterministically verify every proposed comment against the actual diff.
 * A comment survives only when its anchor line exists on the RIGHT side and
 * the echoed content matches (single-line anchors are relocated by content
 * when the model's line number drifted). Everything else is dropped —
 * a misanchored suggestion on a PR is worse than no suggestion.
 */
export function anchorInlineComments(
  files: ChangedFile[],
  proposals: RawInlineComment[],
  maxComments: number,
  marker: string,
): { comments: AnchoredComment[]; dropped: number } {
  const maps = new Map<string, NewLineMap>();
  for (const file of files) {
    if (file.patch) maps.set(file.path, parsePatchNewLines(file.patch));
  }

  const comments: AnchoredComment[] = [];

  for (const proposal of proposals) {
    if (comments.length >= maxComments) break;

    const map = maps.get(proposal.path);
    if (!map || !proposal.original.trim()) continue;

    let line = proposal.line;
    const atLine = map.get(line);
    if (!atLine || !trimEq(atLine.content, proposal.original)) {
      // Re-anchor single-line comments by unique content match.
      const matches = [...map.entries()].filter(([, l]) => trimEq(l.content, proposal.original));
      if (proposal.start_line > 0 || matches.length !== 1) continue;
      line = matches[0][0];
    }

    let startLine: number | undefined;
    if (proposal.start_line > 0) {
      startLine = proposal.start_line;
      let contiguous = startLine < line;
      for (let n = startLine; contiguous && n <= line; n += 1) {
        if (!map.has(n)) contiguous = false;
      }
      if (!contiguous || line - startLine > 20) continue;
    }

    const body =
      proposal.body.trim() +
      (proposal.suggestion.trim() ? fenceSuggestion(proposal.suggestion) : "") +
      `\n\n${marker}`;

    comments.push({ path: proposal.path, line, start_line: startLine, body });
  }

  return { comments, dropped: proposals.length - comments.length };
}
