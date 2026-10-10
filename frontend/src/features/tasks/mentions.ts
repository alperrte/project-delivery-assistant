import type { PersonRef } from "./types";

/**
 * Comments store a mention as the token `@[userId]` (the backend only accepts active project members, anything else
 * stays plain text). People never see the token: the composer shows `@nickname` and these helpers translate both ways.
 */

const TOKEN = /@\[([0-9a-fA-F-]{36})\]/g;
// Same alphabet the backend allows for nicknames (letters and digits of any language, `_` and `-`), so Turkish names
// like çağrı work. A single space may sit between words; it is deliberately not a nickname char (see the boundary checks).
const NICKNAME_CHAR = /[\p{L}\p{N}_-]/u;
// What may follow `@` while a mention is being typed: words of nickname characters joined by single spaces, plus one
// trailing space while the next word is coming. Newlines and double spaces end the mention.
const MENTION_QUERY = /^(?:[\p{L}\p{N}_-]+(?: [\p{L}\p{N}_-]+)* ?)?$/u;
const MAX_QUERY_CODEPOINTS = 32;

export type MentionSegment = { type: "text"; value: string } | { type: "mention"; value: string; userId: string };

/** Splits a stored body into text and mention segments, resolving names from the comment's own `mentions`. */
export function parseMentions(body: string, mentions: PersonRef[]): MentionSegment[] {
  const names = new Map(mentions.map((person) => [person.userId.toLowerCase(), person.nickname ?? "?"]));
  const segments: MentionSegment[] = [];
  let cursor = 0;
  for (const match of body.matchAll(TOKEN)) {
    const userId = match[1];
    const name = names.get(userId.toLowerCase());
    if (name === undefined) continue; // not a member: it remains literal text
    if (match.index > cursor) segments.push({ type: "text", value: body.slice(cursor, match.index) });
    segments.push({ type: "mention", value: `@${name}`, userId });
    cursor = match.index + match[0].length;
  }
  if (cursor < body.length) segments.push({ type: "text", value: body.slice(cursor) });
  return segments;
}

/** Stored body -> the text an editor shows (`@[id]` becomes `@nickname`). */
export function decodeMentions(body: string, mentions: PersonRef[]): string {
  return parseMentions(body, mentions)
    .map((segment) => segment.value)
    .join("");
}

/**
 * Editor text -> stored body. Only people who were picked from the suggestion list become tokens, so typing
 * `@someone` by hand never pings anybody by accident.
 */
export function encodeMentions(text: string, picked: PersonRef[]): string {
  let result = text;
  // Longest nickname first so `@anna_k` is not eaten by `@anna`.
  const byLength = [...picked].filter((person) => person.nickname).sort((a, b) => b.nickname!.length - a.nickname!.length);
  for (const person of byLength) {
    const needle = `@${person.nickname}`;
    let out = "";
    let from = 0;
    for (;;) {
      const at = result.indexOf(needle, from);
      if (at < 0) break;
      const after = result[at + needle.length];
      const before = result[at - 1];
      const boundary = (after === undefined || !NICKNAME_CHAR.test(after)) && (before === undefined || !NICKNAME_CHAR.test(before));
      out += result.slice(from, at) + (boundary ? `@[${person.userId}]` : needle);
      from = at + needle.length;
    }
    result = out + result.slice(from);
  }
  return result;
}

/** The `@query` being typed right before the caret, or `null` when the caret is not in a mention. */
export function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const upToCaret = text.slice(0, caret);
  const at = upToCaret.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && NICKNAME_CHAR.test(upToCaret[at - 1])) return null; // an e-mail address, not a mention
  const query = upToCaret.slice(at + 1);
  return Array.from(query).length <= MAX_QUERY_CODEPOINTS && MENTION_QUERY.test(query) ? { start: at, query } : null;
}

/** Replaces the `@query` at `start` with `@nickname ` and returns the new text and caret position. */
export function insertMention(text: string, caret: number, start: number, nickname: string): { text: string; caret: number } {
  const insert = `@${nickname} `;
  return { text: text.slice(0, start) + insert + text.slice(caret), caret: start + insert.length };
}
