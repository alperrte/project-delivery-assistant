import { membersApi } from "@/features/projects/members-api";
import { squadsApi } from "./api";
import type { Team, TeamMember } from "./types";

/** Bound team requests; no request per person and no separate polling mechanism. */
export async function loadOrganization(projectId: string, teams: readonly Team[], signal?: AbortSignal) {
  const rosters = new Map<string, TeamMember[]>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < teams.length) {
      signal?.throwIfAborted();
      const team = teams[cursor++];
      rosters.set(team.id, await squadsApi.allMembers(projectId, team.id, signal));
    }
  };
  const [members] = await Promise.all([
    membersApi.listAll(projectId, signal),
    Promise.all(Array.from({ length: Math.min(4, teams.length) }, worker)),
  ]);
  return { members, rosters };
}
