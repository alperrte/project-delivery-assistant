import { z } from "zod";
import { normalizeNickname, nicknameProblem } from "@/features/account/nickname";

/**
 * The same rule the backend enforces (StrongPasswordValidator): 8-128 characters with at least one uppercase
 * letter, one digit and one special character (anything that is not a letter, digit or whitespace).
 */
export const PASSWORD_RULES = [
  { key: "length", test: (value: string) => value.length >= 8 },
  { key: "upper", test: (value: string) => /\p{Lu}/u.test(value) },
  { key: "digit", test: (value: string) => /\p{Nd}/u.test(value) },
  { key: "special", test: (value: string) => /[^\p{L}\p{N}\s]/u.test(value) },
] as const;

/** Messages are i18n keys under `validation`; forms translate them on render. */
const strongPassword = z
  .string()
  .min(1, "required")
  .max(128, "passwordMax")
  .superRefine((value, ctx) => {
    if (!PASSWORD_RULES.every((rule) => rule.test(value))) ctx.addIssue({ code: "custom", message: "passwordWeak" });
  });

const code = z.string().regex(/^[0-9]{6}$/, "code");

export const loginSchema = z.object({
  email: z.string().min(1, "required").email("email"),
  password: z.string().min(1, "required"),
  /** Client-only: keep the email on this device. Never sent to the API. */
  remember: z.boolean(),
});

export const registerSchema = z
  .object({
    email: z.string().min(1, "required").email("email"),
    // Trimmed before validation so the submitted value is the stored one; consecutive spaces get their own message.
    nickname: z.string().transform(normalizeNickname).superRefine((value, ctx) => {
      const problem = nicknameProblem(value);
      if (problem) ctx.addIssue({ code: "custom", message: problem === "spaces" ? "nicknameSpaces" : "nickname" });
    }),
    password: strongPassword,
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMatch",
  });

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "required").email("email"),
});

export const verificationCodeSchema = z.object({ code });

/** Third step of "forgot password": the code was already exchanged for a ticket cookie, so only the passwords remain. */
export const resetPasswordSchema = z
  .object({
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMatch",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "required"),
    newPassword: strongPassword,
    confirmNewPassword: z.string().min(1, "required"),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "passwordMatch",
  });

/** Authenticator code (6 digits) or one of the single-use backup codes (xxxxx-xxxxx style, case-insensitive). */
export const secondFactorSchema = z.object({
  code: z.string().trim().min(6, "code").max(32, "code"),
});

/** Turning two-step verification off: the password (empty for accounts without one) plus an authenticator or backup code. */
export const disableTwoFactorSchema = z.object({
  password: z.string().max(128, "passwordMax"),
  code: z.string().trim().min(6, "code").max(32, "code"),
});

export const deleteAccountSchema = z.object({
  email: z.string().min(1, "required").email("email"),
  password: z.string().max(128, "passwordMax"),
  code: z.string().max(32, "code"),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type VerificationCodeValues = z.infer<typeof verificationCodeSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type SecondFactorValues = z.infer<typeof secondFactorSchema>;
export type DisableTwoFactorValues = z.infer<typeof disableTwoFactorSchema>;
export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;
