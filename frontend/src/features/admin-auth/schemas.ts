import { z } from "zod";

/** Messages are i18n keys under `validation`; forms translate them on render. */
export const adminLoginSchema = z.object({
  email: z.string().min(1, "required").email("email"),
  password: z.string().min(1, "required"),
});

const stripSpaces = (value: string) => value.replace(/\s+/g, "");

/** Authenticator code: six digits, pasted spaces ("123 456") tolerated. Send `normalizeAppCode(code)`. */
export const adminAppCodeSchema = z.object({
  code: z.string().refine((value) => /^[0-9]{6}$/.test(stripSpaces(value)), "code"),
});

/** One of the ten single-use backup codes (xxxxx-xxxxx style, case-insensitive). */
export const adminBackupCodeSchema = z.object({
  code: z.string().trim().min(6, "code").max(32, "code"),
});

export const normalizeAppCode = stripSpaces;

export type AdminLoginValues = z.infer<typeof adminLoginSchema>;
export type AdminCodeValues = z.infer<typeof adminAppCodeSchema>;
