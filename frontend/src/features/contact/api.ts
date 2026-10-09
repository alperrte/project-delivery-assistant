import { apiRequest } from "@/lib/api/client";

export type ContactMessage = { firstName: string; lastName: string; email: string; message: string };

export const contactApi = {
  /** Public: no session is needed. The recipient is fixed on the server and cannot be chosen from here. */
  send: (body: ContactMessage) => apiRequest<{ status: "SENT" }>("/contact", { method: "POST", body }),
};
