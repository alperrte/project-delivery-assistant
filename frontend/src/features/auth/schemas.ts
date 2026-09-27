import { z } from "zod";

/** Messages are i18n keys under `validation`; forms translate them on render. */
export const loginSchema = z.object({
  email: z.string().min(1, "required").email("email"),
  password: z.string().min(1, "required"),
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

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
