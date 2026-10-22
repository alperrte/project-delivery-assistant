import type { AssignmentRef, PersonRef } from "./types";

export function uniquePeople(people: PersonRef[]): PersonRef[] {
  return [...new Map(people.map(person => [person.userId, person])).values()];
}

/** Only current recipients are grouped. An old server's aggregate assigners cannot establish individual pairs. */
export function assignmentGroups(assignees: PersonRef[], assigners: PersonRef[], details?: AssignmentRef[]) {
  if (!details) return null;
  const actors = new Map(assigners.map(person => [person.userId, person]));
  const rows = new Map(details.map(row => [row.userId, row]));
  const groups = new Map<string | null, { actor: PersonRef | null; people: PersonRef[] }>();
  for (const person of uniquePeople(assignees)) {
    const actorId = rows.get(person.userId)?.assignedBy ?? null;
    const group = groups.get(actorId) ?? {
      actor: actorId ? actors.get(actorId) ?? { userId: actorId, nickname: null } : null,
      people: [],
    };
    group.people.push(person);
    groups.set(actorId, group);
  }
  return [...groups.values()];
}
