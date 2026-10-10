import { apiRequest } from "@/lib/api/client";
import type { ContactCategory } from "./schemas";

export type ContactMessage = {
  firstName: string;
  /** Left out when empty: the server treats a missing last name as "not given". */
  lastName?: string;
  email: string;
  message: string;
  category: ContactCategory;
  /** Honeypot value; always empty for a person. */
  website: string;
  /** Epoch milliseconds when the form was shown (the server's fill-time check). */
  startedAt: number;
};

export const contactApi = {
  /** Public: no session is needed. The recipient is fixed on the server and cannot be chosen from here. */
  send: (body: ContactMessage) => apiRequest<{ status: "SENT" }>("/contact", { method: "POST", body }),
};
