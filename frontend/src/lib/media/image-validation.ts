export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_MAX_BYTES = 512 * 1024;
export const COVER_MAX_BYTES = 2 * 1024 * 1024;
export function imageValidationError(file: File, maximum: number): "invalidType" | "tooLarge" | "empty" | null {
  if (!IMAGE_TYPES.includes(file.type)) return "invalidType";
  if (file.size === 0) return "empty";
  if (file.size > maximum) return "tooLarge";
  return null;
}
