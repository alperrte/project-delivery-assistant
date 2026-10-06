import type {QueryClient} from "@tanstack/react-query";
import {invitationKeys} from "./query-keys";

/** Successful invitation acceptance changes the current user's membership and private invitation views. */
export async function invalidateInvitationMembership(client:QueryClient) {
  await Promise.all([
    client.invalidateQueries({queryKey:["projects"]}),
    client.invalidateQueries({queryKey:invitationKeys.root}),
  ]);
}
