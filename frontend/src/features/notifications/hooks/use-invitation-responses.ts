"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import { INVITATION_RESPONSE_TYPES, notificationsApi } from "../api";
import { notificationKeys } from "../query-keys";

/** Same foreground cadence as the bell count: 30 s, window focus and reconnect, never in a hidden tab. */
const freshness = {
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
} as const;

/**
 * Own unread accepted/rejected invitation notifications of one project. Notifications go to the inviter only, so
 * the value is 0 for every other member. Separate from the pending-invitation count and never added to it.
 * Keyed by actor and project, so a switch of either never shows the previous scope.
 */
export function useInvitationResponseCount(projectId: string | undefined, enabled: boolean) {
  const { data: user } = useSession();
  return useQuery({
    queryKey: notificationKeys.invitationResponseCount(user?.id, projectId),
    queryFn: ({ signal }) => notificationsApi.unreadCount({ projectId, types: INVITATION_RESPONSE_TYPES }, signal),
    select: result => result.count,
    enabled: enabled && !!projectId && !!user?.id,
    ...freshness,
  });
}

/** The unread answers behind the count (newest first), for the invitations page strip. */
export function useInvitationResponseNotifications(projectId: string | undefined, enabled: boolean) {
  const { data: user } = useSession();
  return useQuery({
    queryKey: notificationKeys.invitationResponseList(user?.id, projectId),
    queryFn: ({ signal }) => notificationsApi.list(0, signal, { read: false, size: 100, types: INVITATION_RESPONSE_TYPES, projectId }),
    enabled: enabled && !!projectId && !!user?.id,
    ...freshness,
  });
}
