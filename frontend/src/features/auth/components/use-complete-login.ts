"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { matchPath } from "@/i18n/routing";
import { authApi } from "../api";
import { sessionQueryKey } from "../hooks/use-session";
import { clearPrivateInvitations } from "@/features/invitations/query-keys";
import { clearPrivateNotifications } from "@/features/notifications/query-keys";
import { clearPrivateTeams } from "@/features/squads/cache";
import { clearPrivateAdmin } from "@/features/admin/query-keys";
import { clearPrivateAuth } from "../query-keys";

/** Pages a signed-in user is never sent back to after login. */
const NOT_RETURNABLE = ["/login", "/register", "/forgot-password", "/change-password", "/verify-email", "/delete-account"];

/**
 * The shared tail of every successful sign-in (password only, or password plus second factor): load the session,
 * drop any cached data of a previous user and go to the page the user asked for, else the dashboard.
 */
export function useCompleteLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async function completeLogin() {
    const me = await authApi.me();
    clearPrivateInvitations(queryClient);
    clearPrivateNotifications(queryClient);
    clearPrivateTeams(queryClient);
    clearPrivateAdmin(queryClient);
    clearPrivateAuth(queryClient);
    queryClient.setQueryData(sessionQueryKey, me);
    const invitation = new URLSearchParams(window.location.hash.slice(1)).get("invitation");
    const requested = new URLSearchParams(window.location.search).get("next");
    let returnPath: string | null = null;
    if (requested?.startsWith("/") && !requested.startsWith("//")) {
      const target = new URL(requested, window.location.origin);
      const matched = matchPath(target.pathname);
      if (target.origin === window.location.origin && matched &&
          !NOT_RETURNABLE.includes(matched.route) &&
          !matched.route.startsWith("/errors/") && !matched.route.startsWith("/dev/")) {
        returnPath = `${matched.internalPath}${target.search}${target.hash}`;
      }
    }
    router.replace(me.mustChangePassword ? "/change-password" : invitation
      ? `/register#invitation=${encodeURIComponent(invitation)}` : returnPath ?? "/dashboard");
  };
}
