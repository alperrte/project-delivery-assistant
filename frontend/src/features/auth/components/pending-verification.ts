/**
 * The address being verified travels between pages in sessionStorage, never in the URL (mail addresses in query
 * strings end up in history, logs and referrers). `sendOnOpen` asks the verify page to mail a fresh code at once:
 * set when a login was refused for an unverified account, not after registration (that already mailed one).
 */
const KEY = "pda.pendingVerification";

export type PendingVerification = { email: string; sendOnOpen: boolean };

export function readPendingVerification(): PendingVerification | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingVerification>;
    return typeof value.email === "string" && value.email ? { email: value.email, sendOnOpen: value.sendOnOpen === true } : null;
  } catch {
    return null;
  }
}

export function writePendingVerification(value: PendingVerification) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // storage blocked: the verify page then asks for the address itself
  }
}

/**
 * The password typed at registration (or at the refused login) is kept in memory only, never in storage, so that the
 * verify page can sign the person in once the code is accepted. It is lost on a reload, and then the person simply
 * signs in. The mailed code alone never opens a session: the password is still what proves who is signing in.
 */
let heldCredentials: { email: string; password: string } | null = null;

export function holdCredentialsForVerification(email: string, password: string) {
  heldCredentials = { email, password };
}

/** Hands the held password over exactly once, and only for the address that was verified. */
export function takeHeldCredentials(email: string): { email: string; password: string } | null {
  const held = heldCredentials;
  heldCredentials = null;
  return held && held.email.toLowerCase() === email.toLowerCase() ? held : null;
}

export function clearPendingVerification() {
  heldCredentials = null;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
