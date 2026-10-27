import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { authenticatedRoute } from "../src/components/layout/authenticated-route";
import { buildPath, localizeHref, matchPath } from "../src/i18n/routing";
import { switchProjectHref } from "../src/features/projects/switch-project-href";
import { meetingNavActive } from "../src/features/meetings/meeting-nav";
import type { Project } from "../src/features/projects/types";

// Meetings belong to users, not projects. These checks need neither a browser nor a backend: they pin the sidebar highlight, the global
// routes (and the redirects of the old project routes), the project switcher and the meeting code itself to that rule.
const ID = "3f2c8a1e-5b7d-4c90-9a61-0d1e2f3a4b5c";

test.describe("meetings sidebar group", () => {
  test("is highlighted from the address alone, with or without a project", () => {
    expect(meetingNavActive("/meetings/new")).toBe("create");
    for (const path of ["/meetings", `/meetings/${ID}`, `/meetings/${ID}/edit`, `/meetings/${ID}/room`]) expect(meetingNavActive(path)).toBe("myMeetings");
    // Nothing else lights it up: not a project page, not the calendar, not a legacy project meetings address.
    for (const path of ["/dashboard", "/projects", "/projects/alpha", "/projects/alpha/tasks", "/calendar", "/projects/alpha/meetings"]) expect(meetingNavActive(path)).toBeNull();
  });
});

test.describe("global meeting routes", () => {
  test("resolve in every language and keep the meeting id as a plain parameter", () => {
    for (const [locale, list, create, room] of [
      ["tr", "toplantilar", "toplantilar/yeni", `toplantilar/${ID}/oda`],
      ["en", "meetings", "meetings/new", `meetings/${ID}/room`],
      ["de", "besprechungen", "besprechungen/neu", `besprechungen/${ID}/raum`],
    ] as const) {
      expect(matchPath(`/${locale}/${list}`)?.route).toBe("/meetings");
      expect(matchPath(`/${locale}/${create}`)?.route).toBe("/meetings/new");
      const found = matchPath(`/${locale}/${room}`);
      expect(found?.route).toBe("/meetings/[meetingId]/room"); expect(found?.params.meetingId).toBe(ID); expect(found?.internalPath).toBe(`/meetings/${ID}/room`);
      expect(buildPath("/meetings/[meetingId]/room", { meetingId: ID }, locale)).toBe(`/${locale}/${room}`);
    }
    expect(localizeHref(`/meetings/${ID}/edit`, "tr")).toBe(`/tr/toplantilar/${ID}/duzenle`);
    // "new" is the create page, never a meeting called "new".
    expect(matchPath("/en/meetings/new")?.route).toBe("/meetings/new");
  });
  test("need a signed-in session, exactly like the other workspace pages", () => {
    for (const path of ["/tr/toplantilar", `/tr/toplantilar/${ID}`, `/tr/toplantilar/${ID}/oda`, "/en/meetings/new", `/de/besprechungen/${ID}/bearbeiten`]) expect(authenticatedRoute(path), path).toBe(true);
    // The public guest routes stay public.
    expect(authenticatedRoute("/tr/toplanti-misafir")).toBe(false);
  });
  test("old project meeting addresses still resolve so they can redirect to the global page", () => {
    expect(matchPath(`/tr/projeler/alpha/toplantilar/${ID}`)?.route).toBe("/projects/[slug]/meetings/[meetingId]");
    expect(matchPath(`/en/projects/alpha/meetings/${ID}/room`)?.route).toBe("/projects/[slug]/meetings/[meetingId]/room");
    expect(authenticatedRoute(`/en/projects/alpha/meetings/${ID}`)).toBe(true);
  });
});

test.describe("project switching", () => {
  const target = { slug: "beta", taskManagementMode: null } as unknown as Project;
  test("never moves or rewrites a meeting page", () => {
    for (const path of ["/meetings", "/meetings/new", `/meetings/${ID}`, `/meetings/${ID}/room`]) expect(switchProjectHref(path, null, target, { manager: true, repository: true }), path).toBeNull();
    // A legacy project meetings address is not carried over to the other project either: it falls back to that project's home.
    expect(switchProjectHref("/projects/alpha/meetings", null, target, { manager: true, repository: true })).toBe("/projects/beta");
    // The project surfaces still switch as before.
    expect(switchProjectHref("/projects/alpha/teams", null, target, { manager: true, repository: true })).toBe("/projects/beta/teams");
  });
});

test.describe("meeting source", () => {
  const root = path.resolve(__dirname, "../src/features/meetings");
  const files = (directory: string): string[] => readdirSync(directory).flatMap(name => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
  test("never follows the sidebar's selected project or a project role, and only the create flow, form, list and kind files name a project", () => {
    // Meetings are hybrid: a project meeting carries the project chosen when it was created, but nothing here follows the selected project or a role.
    const forbidden = [/useSelectedProject/, /useCurrentMember/, /PROJECT_MANAGER/, /isManager/, /managerProjectId/, /\/projects\/\$\{[^}]*\}\/meetings/];
    const mayNameProjectId = new Set(["meeting-create.tsx", "meeting-form.tsx", "meeting-kind.tsx", "types.ts", "meeting-list.ts", "meetings-page.tsx"]);
    for (const file of files(root)) {
      const text = readFileSync(file, "utf8");
      for (const pattern of forbidden) expect(pattern.test(text), `${path.relative(root, file)} must not match ${pattern}`).toBe(false);
      if (!mayNameProjectId.has(path.basename(file))) expect(/projectId/.test(text), `${path.relative(root, file)} must not use a projectId`).toBe(false);
    }
  });
  test("the room, the cache keys and the API client never query projects", () => {
    for (const name of ["shared.tsx", "use-meeting-room.ts", "meeting-room.tsx", "api.ts"]) {
      const text = readFileSync(path.join(root, name), "utf8");
      expect(/projectsApi|membersApi|useSelectedProject/.test(text), name).toBe(false);
    }
  });
  test("api client addresses meetings by their own id under /meetings only", () => {
    const api = readFileSync(path.join(root, "api.ts"), "utf8");
    expect(api).toContain('const root = "/meetings"');
    expect(api.includes("/projects")).toBe(false); // the project of a meeting travels in the request body, never in the address
  });
});
