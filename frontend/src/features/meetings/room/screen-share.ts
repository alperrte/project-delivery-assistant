/**
 * Screen sharing depends on `navigator.mediaDevices.getDisplayMedia`, which only exists in secure contexts and, on phones,
 * in practically no browser: Android Chrome/Firefox/Samsung Internet and every iOS browser (all WebKit) leave it out.
 * No web code can change that, so the button must say so instead of failing silently. Support is detected from the
 * browser's real capability, never from the user agent, so a phone or tablet browser that does ship the API just works.
 */
export type ScreenShareMessage = "screenShareUnsupported" | "screenShareCancelled" | "screenShareDenied" | "screenShareFailed";

export function canShareScreen(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/**
 * Maps a failed start to one of the four user-facing messages.
 * Browsers answer "picker dismissed" and "permission refused" with the same NotAllowedError; only the text of the
 * operating-system or policy refusals differs, so those are told apart by it and everything else counts as a cancel.
 */
export function screenShareMessage(failure: unknown): ScreenShareMessage {
  const name = failure instanceof Error ? failure.name : "";
  const text = failure instanceof Error ? failure.message : "";
  if (name === "DeviceUnsupportedError" || name === "NotSupportedError" || (name === "TypeError" && !canShareScreen())) return "screenShareUnsupported";
  if (name === "AbortError") return "screenShareCancelled";
  if (name === "NotAllowedError" || name === "SecurityError") return /system|policy|secure|insecure/i.test(text) || name === "SecurityError" ? "screenShareDenied" : "screenShareCancelled";
  return "screenShareFailed";
}
