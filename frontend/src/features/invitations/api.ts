import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Member, ProjectRole } from "@/features/projects/types";
import type { CreatedInvitation, Invitation, MyInvitation, ExternalInvitationPreview, AcceptedExternalInvitation } from "./types";

export const invitationsApi = {
  list: (projectId: string, page: number, size = 20) =>
    apiRequest<Page<Invitation>>(`/projects/${projectId}/invitations/all?page=${page}&size=${size}`),
  create: (projectId: string, body: { userId?: string; email?: string; firstName?: string; lastName?: string; message?: string; roles: ProjectRole[] }) =>
    apiRequest<CreatedInvitation>(`/projects/${projectId}/invitations`, { method: "POST", body }),
  resend: (projectId: string, invitationId: string) =>
    apiRequest<CreatedInvitation>(`/projects/${projectId}/invitations/${invitationId}/resend`, { method: "POST" }),
  cancel: (projectId: string, invitationId: string) =>
    apiRequest<void>(`/projects/${projectId}/invitations/${invitationId}`, { method: "DELETE" }),
  reject: (projectId: string, invitationId: string, token: string) =>
    apiRequest<void>(`/projects/${projectId}/invitations/${invitationId}/reject`, { method: "POST", body: { token } }),
  accept: (projectId: string, invitationId: string, token: string) =>
    apiRequest<Member>(`/projects/${projectId}/invitations/${invitationId}/accept`, { method: "POST", body: { token } }),
  mine: (page: number, size = 20) =>
    apiRequest<Page<MyInvitation>>(`/project-invitations/me?page=${page}&size=${size}`),
  acceptMine: (invitationId: string) =>
    apiRequest<Member>(`/project-invitations/${invitationId}/accept`, { method: "POST" }),
  rejectMine: (invitationId: string, message: string) =>
    apiRequest<void>(`/project-invitations/${invitationId}/reject`, { method: "POST", body: { message } }),
  previewExternal: (token: string) => apiRequest<ExternalInvitationPreview>("/project-invitations/external/preview", { method: "POST", body: { token } }),
  acceptExternal: (token: string) => apiRequest<AcceptedExternalInvitation>("/project-invitations/external/accept", { method: "POST", body: { token } }),
};
