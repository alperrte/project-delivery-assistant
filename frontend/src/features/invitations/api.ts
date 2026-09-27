import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Member, ProjectRole } from "@/features/projects/types";
import type { CreatedInvitation, Invitation } from "./types";

export const invitationsApi = {
  list: (projectId: string, page: number, size = 20) =>
    apiRequest<Page<Invitation>>(`/projects/${projectId}/invitations?page=${page}&size=${size}`),
  create: (projectId: string, body: { userId?: string; email?: string; roles: ProjectRole[] }) =>
    apiRequest<CreatedInvitation>(`/projects/${projectId}/invitations`, { method: "POST", body }),
  resend: (projectId: string, invitationId: string) =>
    apiRequest<CreatedInvitation>(`/projects/${projectId}/invitations/${invitationId}/resend`, { method: "POST" }),
  cancel: (projectId: string, invitationId: string) =>
    apiRequest<void>(`/projects/${projectId}/invitations/${invitationId}`, { method: "DELETE" }),
  reject: (projectId: string, invitationId: string, token: string) =>
    apiRequest<void>(`/projects/${projectId}/invitations/${invitationId}/reject`, { method: "POST", body: { token } }),
  accept: (projectId: string, invitationId: string, token: string) =>
    apiRequest<Member>(`/projects/${projectId}/invitations/${invitationId}/accept`, { method: "POST", body: { token } }),
};
