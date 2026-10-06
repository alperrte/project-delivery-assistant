import type { QueryClient } from "@tanstack/react-query";
import { teamsKey } from "./hooks";

/** Confirmed server deletion affects team rosters, invitations and the existing archived-target pool audience. */
export function invalidateTeamDeletion(client: QueryClient, projectId: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: teamsKey(projectId) }),
    client.invalidateQueries({ queryKey: ["projects", projectId, "members"] }),
    client.invalidateQueries({ queryKey: ["projects", projectId, "invitations"] }),
    client.invalidateQueries({ queryKey: ["project-invitations"] }),
    client.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] }),
    client.invalidateQueries({ queryKey: ["tasks"] }),
    client.invalidateQueries({ queryKey: ["notifications"] }),
  ]);
}

export function clearPrivateTeams(client: QueryClient) {
  const predicate = ({ queryKey }: { queryKey: readonly unknown[] }) => queryKey[0] === "projects" && queryKey[2] === "squads";
  void client.cancelQueries({ predicate });
  client.removeQueries({ predicate });
}
