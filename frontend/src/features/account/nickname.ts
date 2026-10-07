export const normalizeNickname = (value: string) => value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
export const validNickname = (value: string) => /^[\p{L}\p{N}_]{3,32}$/u.test(normalizeNickname(value));

/** Only cached projections which carry live display identities; no criteria/media/count/global clear. */
export function nicknameIdentityQuery(key: readonly unknown[], actorId: string) {
  if (key[0] === "projects") {
    if (["members", "squads", "chat", "home"].includes(String(key[2]))) return true;
    if (key[2] === "tasks") return !["counts", "labels"].includes(String(key[3]));
    if (key[2] === "invitations") return key.includes(actorId);
  }
  if (key[0] === "tasks") return key[1] === "mine" || key[1] === "pool";
  if (key[0] === "project-invitations" || key[0] === "notifications") return key.includes(actorId);
  return false;
}
