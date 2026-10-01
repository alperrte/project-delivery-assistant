import { useQuery } from "@tanstack/react-query";
import { invitationsApi } from "./api";

/** Pending invitations of a project, read from the total of a one-row page. Only managers can see invitations. */
export function usePendingInvitationCount(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["projects", projectId, "invitations", "pending-count"],
    queryFn: () => invitationsApi.list(projectId, 0, 1, "PENDING"),
    select: (page) => page.totalElements,
    enabled: enabled && !!projectId,
  });
}
