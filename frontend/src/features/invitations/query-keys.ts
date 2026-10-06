import type { QueryClient } from "@tanstack/react-query";

/** Private invitation data belongs to a principal, never just to a document/session query client. */
export const invitationKeys = {
  root: ["project-invitations"] as const,
  mineRoot: (userId: string | undefined) => ["project-invitations", "actor", userId, "me"] as const,
  mine: (userId: string | undefined, filter: string, page: number) => [...invitationKeys.mineRoot(userId), filter, page] as const,
  preview: (userId: string | undefined, id: string | null) => ["project-invitations", "actor", userId, "preview", id] as const,
  project: (projectId: string, userId: string | undefined) => ["projects", projectId, "invitations", "actor", userId] as const,
};

export function isPrivateInvitationQuery({queryKey}:{queryKey:readonly unknown[]}) {
  return queryKey[0] === "project-invitations" || (queryKey[0] === "projects" && queryKey[2] === "invitations");
}

export function clearPrivateInvitations(client: QueryClient) {
  void client.cancelQueries({ predicate: isPrivateInvitationQuery });
  client.removeQueries({ predicate: isPrivateInvitationQuery });
}
