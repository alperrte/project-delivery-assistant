/**
 * Single nickname contract shared by registration, invitation registration and the profile field. It mirrors the
 * backend `NicknameRules` exactly: Unicode letters/digits, `_`, `-` and single ordinary spaces between words,
 * 3-32 code points, leading/trailing whitespace trimmed first. Consecutive spaces and any other whitespace,
 * control or invisible character are invalid and are never rewritten silently.
 */
export const NICKNAME_PATTERN = /^(?=[\p{L}\p{N}_ -]{3,32}$)[\p{L}\p{N}_-]+(?: [\p{L}\p{N}_-]+)*$/u;

export const normalizeNickname = (value: string) => value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");

export const validNickname = (value: string) => NICKNAME_PATTERN.test(normalizeNickname(value));

/** True when the (trimmed) value contains two or more consecutive spaces, which deserves its own message. */
export const hasConsecutiveSpaces = (value: string) => /  /.test(normalizeNickname(value));

/** Why a nickname is not acceptable, so forms can pick the right message. `null` means valid. */
export function nicknameProblem(value: string): "spaces" | "invalid" | null {
  if (validNickname(value)) return null;
  return hasConsecutiveSpaces(value) ? "spaces" : "invalid";
}

/**
 * Only cached projections which carry live display identities; no criteria/media/count/global clear.
 * Project keys: `["projects", projectId, "members"|"squads"|"chat"|"home"|"reminders"|"tasks"|"invitations", ...]`,
 * `["projects", page]` (list), `["projects", "dashboard"]`, `["projects", "by-slug"|"detail", ...]`.
 */
export function nicknameIdentityQuery(key: readonly unknown[], actorId: string) {
  if (key[0] === "projects") {
    if (typeof key[1] === "number" || ["dashboard", "by-slug", "detail"].includes(String(key[1]))) return true;
    if (["members", "squads", "chat", "home", "reminders"].includes(String(key[2]))) return true;
    if (key[2] === "tasks") return !["counts", "labels"].includes(String(key[3]));
    if (key[2] === "invitations") return key.includes(actorId);
  }
  if (key[0] === "project-home") return true;
  if (key[0] === "organizations") return key[1] === "projects";
  if (key[0] === "admin") return key[1] === actorId && key[2] === "users";
  if (key[0] === "tasks") return key[1] === "mine" || key[1] === "pool";
  if (key[0] === "project-invitations" || key[0] === "notifications") return key.includes(actorId);
  return false;
}
