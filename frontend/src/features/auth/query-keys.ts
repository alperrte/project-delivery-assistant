import type { QueryClient } from "@tanstack/react-query";

/** The signed-in account's two-step verification status (account page). */
export const twoFactorStatusKey = ["auth", "2fa"] as const;

/**
 * Account-bound auth data other than the session itself. Removed with the other private families when a session
 * ends or begins, so the next account in the same tab never reads this account's two-step verification status.
 */
export function clearPrivateAuth(client: QueryClient) {
  void client.cancelQueries({ queryKey: ["auth"] });
  client.removeQueries({ queryKey: ["auth"] });
}
