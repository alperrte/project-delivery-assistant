import { z } from "zod";

/** Mirrors the server's limits (`ContactMessage` in the backend); the server stays the authority. Messages are `contact.validation` keys. */
export const CONTACT_LIMITS = { nameMax: 80, emailMax: 254, messageMin: 10, messageMax: 5000 } as const;

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "required").max(CONTACT_LIMITS.nameMax, "nameMax"),
  lastName: z.string().trim().min(1, "required").max(CONTACT_LIMITS.nameMax, "nameMax"),
  email: z.string().trim().min(1, "required").max(CONTACT_LIMITS.emailMax, "emailMax").email("email"),
  message: z.string().trim().min(1, "required").min(CONTACT_LIMITS.messageMin, "messageMin").max(CONTACT_LIMITS.messageMax, "messageMax"),
});

export type ContactValues = z.infer<typeof contactSchema>;
