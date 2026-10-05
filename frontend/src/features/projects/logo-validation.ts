import { IMAGE_TYPES, LOGO_MAX_BYTES, imageValidationError } from "@/lib/media/image-validation";
export { LOGO_MAX_BYTES };
export const LOGO_ACCEPTED_TYPES = IMAGE_TYPES;
export function logoValidationError(file: File) { return imageValidationError(file, LOGO_MAX_BYTES); }
