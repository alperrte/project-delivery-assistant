export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_MAX_BYTES = 512 * 1024;
export const COVER_MAX_BYTES = 2 * 1024 * 1024;
export function imageValidationError(file: File, maximum: number): "invalidType" | "tooLarge" | "empty" | null {
  if (!IMAGE_TYPES.includes(file.type)) return "invalidType";
  if (file.size === 0) return "empty";
  if (file.size > maximum) return "tooLarge";
  return null;
}

/** Optional local preview validation. Upload authorization and byte validation remain server responsibilities. */
export async function canDecodeImage(file: File): Promise<boolean> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try { return bitmap.width > 0 && bitmap.height > 0; }
      finally { bitmap.close(); }
    } catch { return false; }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    return image.naturalWidth > 0 && image.naturalHeight > 0;
  } catch { return false; }
  finally { URL.revokeObjectURL(url); }
}
