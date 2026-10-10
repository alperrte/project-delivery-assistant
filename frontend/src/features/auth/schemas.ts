import { z } from "zod";
import { normalizeNickname, nicknameProblem } from "@/features/account/nickname";

/** Messages are i18n keys under `validation`; forms translate them on render. */
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
    password: z.string().min(8, "passwordMin").max(128, "passwordMax"),
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMatch",
  });

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "required").email("email"),
});

export const resetPasswordSchema = z
  .object({
    code: z.string().regex(/^[0-9]{6}$/, "code"),
    newPassword: z.string().min(8, "passwordMin").max(128, "passwordMax"),
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMatch",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "required"),
    newPassword: z.string().min(8, "passwordMin").max(128, "passwordMax"),
    confirmNewPassword: z.string().min(1, "required"),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "passwordMatch",
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
