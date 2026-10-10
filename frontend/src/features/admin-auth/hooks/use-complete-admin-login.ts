"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { matchPath } from "@/i18n/routing";
import { authApi } from "@/features/auth/api";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import { clearPrivateAuth } from "@/features/auth/query-keys";
import { clearPrivateInvitations } from "@/features/invitations/query-keys";
import { clearPrivateNotifications } from "@/features/notifications/query-keys";
import { clearPrivateTeams } from "@/features/squads/cache";
import { clearPrivateAdmin } from "@/features/admin/query-keys";

const PANEL = "/admin/users";

/**
 * Where a finished administrator sign-in goes: the administration page the visitor was sent away from (`?next=`, only
 * ever an `/admin` page of this site), else the first section of the panel.
 */
export function adminLandingPath(search: string): string {
  const requested = new URLSearchParams(search).get("next");
  if (requested?.startsWith("/") && !requested.startsWith("//")) {
    const target = new URL(requested, window.location.origin);
    const matched = matchPath(target.pathname);
    if (target.origin === window.location.origin && matched?.route.startsWith("/admin")) {
      return `${matched.internalPath === "/admin" ? PANEL : matched.internalPath}${target.search}`;
    }
  }
  return PANEL;
}

/**
 * The tail of a successful administrator sign-in, the same cache hygiene as the regular sign-in: load the session,
 * drop whatever a previous account left in the cache, then open the panel.
 */
export function useCompleteAdminLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async function completeAdminLogin() {
    const me = await authApi.me();
    clearPrivateInvitations(queryClient);
    clearPrivateNotifications(queryClient);
    clearPrivateTeams(queryClient);
    clearPrivateAdmin(queryClient);
    clearPrivateAuth(queryClient);
    queryClient.setQueryData(sessionQueryKey, me);
    router.replace(adminLandingPath(window.location.search));
  };
}
