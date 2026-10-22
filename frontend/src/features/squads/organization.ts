import type { Member } from "@/features/projects/types";
import type { Team, TeamMember, TeamRef } from "./types";

export type OrganizationPerson = Member & { teams: TeamRef[] };
export type OrganizationNode = { team: Team; members: OrganizationPerson[]; children: OrganizationNode[] };

/** Project membership is canonical; roster-only identities cannot introduce people. */
export function buildOrganization(projectId: string, teams: readonly Team[], members: readonly Member[], rosters: ReadonlyMap<string, readonly TeamMember[]>) {
  const people = new Map(members.map(member => [member.userId, { ...member, roles: [...new Set(member.roles)], teams: [] as TeamRef[] }]));
  const nodes = new Map<string, OrganizationNode>();
  for (const team of teams) if (team.projectId === projectId) nodes.set(team.id, { team, members: [], children: [] });
  for (const node of nodes.values()) {
    const seen = new Set<string>();
    for (const row of rosters.get(node.team.id) ?? []) {
      const person = people.get(row.userId);
      if (!person || seen.has(row.userId)) continue;
      seen.add(row.userId);
      node.members.push(person);
      person.teams.push({ id: node.team.id, name: node.team.name });
    }
  }
  const parents = new Map([...nodes.values()].map(({ team }) => [team.id, team.parentTeamId && nodes.has(team.parentTeamId) ? team.parentTeamId : null]));
  // Cut one edge per cycle, including self-parenting; every team remains visible.
  const visited = new Set<string>();
  for (const id of nodes.keys()) {
    const path = new Set<string>();
    let cursor: string | null = id;
    while (cursor && !visited.has(cursor)) {
      if (path.has(cursor)) { parents.set(cursor, null); break; }
      path.add(cursor);
      cursor = parents.get(cursor) ?? null;
    }
    path.forEach(value => visited.add(value));
  }
  const roots: OrganizationNode[] = [];
  for (const node of nodes.values()) {
    const parent = parents.get(node.team.id);
    (parent ? nodes.get(parent)!.children : roots).push(node);
  }
  const all = [...people.values()];
  return { roots, people: all, teamTotal: nodes.size, managers: all.filter(person => person.roles.includes("PROJECT_MANAGER")), unassigned: all.filter(person => person.teams.length === 0) };
}
