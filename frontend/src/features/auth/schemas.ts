import { z } from "zod";

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
    nickname: z.string().regex(/^[\p{L}\p{N}_]{3,32}$/u, "nickname"),
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
