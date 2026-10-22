import { expect, test } from "@playwright/test";
import type { Member } from "../src/features/projects/types";
import type { Team, TeamMember } from "../src/features/squads/types";
import { buildOrganization, type OrganizationNode } from "../src/features/squads/organization";
import { loadOrganization } from "../src/features/squads/organization-api";

const member = (userId: string, roles: Member["roles"] = ["TESTER"]): Member => ({ userId, nickname: userId, roles, joinedAt: "2026-10-22T00:00:00Z" });
const team = (id: string, parentTeamId: string | null = null): Team => ({ id, parentTeamId, projectId: "p", name: id, description: null, memberCount: 0, createdBy: "a", createdAt: "", updatedAt: "", updatedBy: { userId: "a", nickname: "a" }, memberPreview: [], lastJoined: null });
const row = (id: string): TeamMember => ({ ...member(id), email: "not-displayed@example.test", addedBy: "a", addedAt: "", otherTeams: [] });
const flatten = (nodes: OrganizationNode[]): string[] => nodes.flatMap(node => [node.team.id, ...flatten(node.children)]);

test("SSF canonical identities, every role, overlapping memberships and unassigned people remain distinct", () => {
  const members = [member("manager", ["PROJECT_MANAGER", "BACKEND_DEVELOPER"]), member("unassigned"), member("shared"), member("shared")];
  const data = buildOrganization("p", [team("root"), team("child", "root")], members, new Map([
    ["root", [row("manager"), row("shared"), row("shared"), row("removed")]], ["child", [row("shared")]],
  ]));
  expect(data.people).toHaveLength(3);
  expect(data.managers.map(person => person.roles)).toEqual([["PROJECT_MANAGER", "BACKEND_DEVELOPER"]]);
  expect(data.unassigned.map(person => person.userId)).toEqual(["unassigned"]);
  expect(data.people.find(person => person.userId === "shared")?.teams.map(item => item.id)).toEqual(["root", "child"]);
  expect(data.roots[0].members.map(person => person.userId)).toEqual(["manager", "shared"]);
  expect(JSON.stringify(data)).not.toContain("not-displayed@example.test");
  expect(members[0]).not.toHaveProperty("teams");
});

test("SSF empty/no-team projects still represent all active people", () => {
  expect(buildOrganization("p", [], [member("one")], new Map()).unassigned).toHaveLength(1);
  const empty = buildOrganization("p", [team("empty")], [], new Map());
  expect(empty.people).toHaveLength(0);
  expect(empty.roots[0].members).toEqual([]);
});

test("SSF three levels, missing parents, cycles, self-links and foreign teams never lose or infinitely recurse", () => {
  const teams = [team("a"), team("b", "a"), team("c", "b"), team("orphan", "absent"), team("cycle1", "cycle2"), team("cycle2", "cycle1"), team("self", "self"), { ...team("foreign"), projectId: "other" }];
  const data = buildOrganization("p", teams, [], new Map());
  expect(data.roots[0].children[0].children[0].team.id).toBe("c");
  expect(flatten(data.roots).sort()).toEqual(teams.filter(item => item.projectId === "p").map(item => item.id).sort());
  expect(data.teamTotal).toBe(7);
  expect(teams[4].parentTeamId).toBe("cycle2");
});

test("SSF complete project and team pagination, including more than 100 people", async () => {
  const original = global.fetch;
  const calls: string[] = [];
  global.fetch = async input => {
    const url = new URL(String(input)); calls.push(url.pathname + url.search);
    const page = Number(url.searchParams.get("page"));
    const isRoster = url.pathname.includes("/teams/");
    const content = Array.from({ length: page ? 5 : 100 }, (_, index) => isRoster ? row(`person${page * 100 + index}`) : member(`person${page * 100 + index}`));
    return new Response(JSON.stringify({ content, totalPages: 2, totalElements: 105, page, size: 100 }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    const raw = await loadOrganization("p", [team("root")]);
    const data = buildOrganization("p", [team("root")], raw.members, raw.rosters);
    expect(data.people).toHaveLength(105);
    expect(data.roots[0].members).toHaveLength(105);
    expect(calls).toHaveLength(4);
    expect(calls.filter(url => url.includes("page=1"))).toHaveLength(2);
  } finally { global.fetch = original; }
});

test("SSF a failed roster read rejects the aggregate instead of inventing unassigned membership", async () => {
  const original = global.fetch;
  global.fetch = async input => new Response(JSON.stringify(String(input).includes("/teams/") ? { code: "FORBIDDEN" } : { content: [member("one")], totalPages: 1 }), { status: String(input).includes("/teams/") ? 403 : 200 });
  try { await expect(loadOrganization("p", [team("root")])).rejects.toMatchObject({ status: 403 }); }
  finally { global.fetch = original; }
});
