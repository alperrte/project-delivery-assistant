import { test, expect } from "@playwright/test";
import { assignmentGroups, uniquePeople } from "../src/features/tasks/assignment";

const a = { userId: "a", nickname: "Actor A" };
const b = { userId: "b", nickname: "Actor B" };
test("current actor pairs preserve self-assignment, mixed sources and deduplicate recipients", () => {
  const groups = assignmentGroups([a, b, a], [a, b], [
    { userId: "a", assignedBy: "a", assignedAt: "2020-01-01" },
    { userId: "b", assignedBy: "b", assignedAt: "2020-01-01" },
  ]);
  expect(groups).toEqual([{ actor: a, people: [a] }, { actor: b, people: [b] }]);
  expect(uniquePeople([a, a, b])).toEqual([a, b]);
});
test("legacy null/missing source and removed rows never invent an actor", () => {
  expect(assignmentGroups([a], [b], [{ userId: "a", assignedBy: null, assignedAt: "2020-01-01" }])).toEqual([{ actor: null, people: [a] }]);
  expect(assignmentGroups([a], [b])).toBeNull();
  expect(assignmentGroups([], [b], [{ userId: "a", assignedBy: "b", assignedAt: "2020-01-01" }])).toEqual([]);
});
test("unavailable source keeps its actual identity with no replacement by another active person", () => {
  expect(assignmentGroups([b], [], [{ userId: "b", assignedBy: "a", assignedAt: "2020-01-01" }])).toEqual([{ actor: { userId: "a", nickname: null }, people: [b] }]);
});
