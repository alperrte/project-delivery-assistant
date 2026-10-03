/** Message text rules. The backend is the source of truth; this only mirrors them to save a round trip. */

export const MESSAGE_MAX_LENGTH = 2000;

export type MessageValidation =
  | { ok: true; content: string }
  | { ok: false; error: "empty" | "tooLong" | "invalid" };

/** Characters the user cannot see but that make a message look empty. */
const INVISIBLE_ONLY = /^[\s ​-‍⁠﻿]*$/u;

/** Line endings become a single `\n`, the outer whitespace is stripped (exactly what the server stores). */
export function normalizeMessage(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").trim();
}

/** Length in characters (code points), the way the server counts, so an emoji is one character. */
export function messageLength(text: string): number {
  return Array.from(text).length;
}

function hasForbiddenControl(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    // Control characters other than newline (10) and tab (9) are refused.
    if ((code < 32 && code !== 9 && code !== 10) || (code >= 127 && code <= 159)) return true;
  }
  return false;
}

export function validateMessage(raw: string): MessageValidation {
  const content = normalizeMessage(raw);
  if (content === "" || INVISIBLE_ONLY.test(content)) return { ok: false, error: "empty" };
  if (messageLength(content) > MESSAGE_MAX_LENGTH) return { ok: false, error: "tooLong" };
  if (hasForbiddenControl(content)) return { ok: false, error: "invalid" };
  return { ok: true, content };
}

const PREVIEW_LENGTH = 140;

/** The single-line preview of the conversation list (same rule as the server's). */
export function previewOf(content: string): string {
  const singleLine = content.replace(/\s+/g, " ").trim();
  const chars = Array.from(singleLine);
  return chars.length <= PREVIEW_LENGTH ? singleLine : `${chars.slice(0, PREVIEW_LENGTH - 1).join("")}…`;
}
