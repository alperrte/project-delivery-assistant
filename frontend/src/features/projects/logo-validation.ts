/** Client checks save a round trip; the server validates size and magic bytes again. */
export const LOGO_MAX_BYTES = 512 * 1024;
export const LOGO_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
export function logoValidationError(file: File): "invalidType" | "tooLarge" | "empty" | null {
  if (!LOGO_ACCEPTED_TYPES.includes(file.type)) return "invalidType";
  if (file.size === 0) return "empty";
  if (file.size > LOGO_MAX_BYTES) return "tooLarge";
  return null;
}
