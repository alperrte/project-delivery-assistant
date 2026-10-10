import { z } from "zod";

/** Mirrors the server's limits (`ContactMessage` in the backend); the server stays the authority. Messages are `contact.validation` keys. */
export const CONTACT_LIMITS = { nameMax: 80, emailMax: 254, messageMin: 10, messageMax: 5000 } as const;

/** The four topics the server accepts (`ContactCategory`); the default is the general one. */
export const CONTACT_CATEGORIES = ["GENERAL", "BUG", "DATA_REQUEST", "ACCESSIBILITY"] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "required").max(CONTACT_LIMITS.nameMax, "nameMax"),
  // Optional (data minimisation): an empty value means "not given".
  lastName: z.string().trim().max(CONTACT_LIMITS.nameMax, "nameMax"),
  email: z.string().trim().min(1, "required").max(CONTACT_LIMITS.emailMax, "emailMax").email("email"),
  category: z.enum(CONTACT_CATEGORIES),
  message: z.string().trim().min(1, "required").min(CONTACT_LIMITS.messageMin, "messageMin").max(CONTACT_LIMITS.messageMax, "messageMax"),
  /** Honeypot: people never see this field, so anything in it marks a bot. It is not validated, only passed on. */
  website: z.string(),
});

export type ContactValues = z.infer<typeof contactSchema>;
