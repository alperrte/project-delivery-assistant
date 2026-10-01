import { apiRequest } from "@/lib/api/client";
import type { CreateReminderInput, Reminder, ReminderInput } from "./types";

export const remindersApi = {
  /** Reminders the caller may see in `[from, to]` (inclusive `YYYY-MM-DD`); the server filters by visibility. */
  list: (projectId: string, from: string, to: string) =>
    apiRequest<Reminder[]>(`/projects/${projectId}/reminders?from=${from}&to=${to}`),
  detail: (projectId: string, reminderId: string) =>
    apiRequest<Reminder>(`/projects/${projectId}/reminders/${reminderId}`),
  create: (projectId: string, body: CreateReminderInput) =>
    apiRequest<Reminder>(`/projects/${projectId}/reminders`, { method: "POST", body }),
  update: (projectId: string, reminderId: string, body: ReminderInput) =>
    apiRequest<Reminder>(`/projects/${projectId}/reminders/${reminderId}`, { method: "PATCH", body }),
  remove: (projectId: string, reminderId: string) =>
    apiRequest<void>(`/projects/${projectId}/reminders/${reminderId}`, { method: "DELETE" }),
};
