import type { Project, ProjectHome, Member } from "@/features/projects/types";
import type { Team, TeamMember } from "@/features/squads/types";
import type { Task, TaskStatus } from "@/features/tasks/types";
import type { Commit, RepositoryBranches, RepositoryCompare, RepositoryConnection } from "@/features/repository/types";
import type { ChatMessage } from "@/features/chat/types";
import type { Meeting } from "@/features/meetings/types";

export const DEMO_USER = { id: "pda-demo-alper", nickname: "Alper", email: "alper@example.com", globalRole: "USER", mustChangePassword: false };
const date = "2026-10-03T09:00:00Z";
const before = (value: number) => new Date(Date.now() - value * 60_000).toISOString();
const after = (value: number) => new Date(Date.now() + value * 60_000).toISOString();
/** The landing copy supplies the visible words; the optional `demoTask*`, `demoCommit*`, `demoMeeting*`, `demoChat*` keys fall back to English. */
export type DemoText = { projectName: string; projectAbout: string; teamName: string; teamAbout: string; taskName: string } & Record<string, string>;
export function demoData(text: DemoText) {
  const line = (key: string, fallback: string) => text[key] ?? fallback;
  const members: Member[] = [
    { userId: DEMO_USER.id, nickname: "Alper", roles: ["PROJECT_MANAGER"], joinedAt: date },
    { userId: "pda-demo-deniz", nickname: "Deniz", roles: ["FULL_STACK_DEVELOPER"], joinedAt: date },
    { userId: "pda-demo-ece", nickname: "Ece", roles: ["TESTER"], joinedAt: date },
  ];
  const people = members.map(m => ({ userId: m.userId, nickname: m.nickname! }));
  const project: Project = {
    taskManagementMode: "BOTH",
    id: "pda-demo-project", slug: "pda-demo", name: text.projectName, description: text.projectAbout,
    status: "PLANNING", priority: "MEDIUM", startDate: null, targetEndDate: null, projectGoal: text.projectAbout,
    techStack: "Next.js, Spring Boot, PostgreSQL", visibility: "PRIVATE", organizationId: null,
    createdBy: DEMO_USER.id, createdAt: date, updatedAt: date, archivedAt: null, projectType: "WEB", tagline: text.projectAbout,
    logoShape: "SQUARE",
    logoVersion: null, bannerVersion: null, updatedBy: people[0], team: { memberCount: 3, preview: people },
  };
  const home: ProjectHome = {
    id: project.id, slug: project.slug, name: project.name, status: project.status, priority: project.priority,
    startDate: null, targetEndDate: null, organization: null, managers: [people[0]], teamMemberCount: 3,
    criteriaProgress: { completed: 0, total: 0 }, createdAt: date, updatedAt: date,
    repository: { connected: false, provider: null, repositoryOwner: null, repositoryName: null, defaultBranch: null, trackingMode: null, notifyOnCommits: false, lastCommit: null, githubUnavailable: false },
  };
  const team: Team = {
    id: "pda-demo-team", projectId: project.id, name: text.teamName, description: text.teamAbout,
    parentTeamId: null, memberCount: 3, createdBy: DEMO_USER.id, createdAt: date, updatedAt: date,
    updatedBy: people[0], memberPreview: members.map(m => ({ userId: m.userId, nickname: m.nickname!, roles: m.roles })), lastJoined: null,
  };
  const roster: TeamMember[] = members.map(m => ({ ...m, email: `${m.nickname!.toLowerCase()}@example.com`, addedBy: DEMO_USER.id, addedAt: date, otherTeams: [] }));
  const task: Task = {
    creationMode: "ADVANCED",
    id: "pda-demo-task", projectId: project.id, taskNumber: 1, taskKey: "PDA-1", title: text.taskName, description: text.projectAbout,
    status: "DONE", priority: "MEDIUM", startDate: null, deadlineAt: null, overdue: false, blocked: false, blockedReason: null,
    hasOpenBlockers: false, createdBy: DEMO_USER.id, createdByName: "Alper", createdAt: date, updatedBy: DEMO_USER.id, updatedByName: "Alper", updatedAt: date,
    archivedAt: null, version: 0, assigneeIds: [DEMO_USER.id], assignees: [people[0]], labels: [], parent: null,
    subtaskCount: 0, subtaskDoneCount: 0, checklistTotal: 0, checklistDone: 0, commentCount: 0, attachmentCount: 0,
    estimatePoints: null, timeEstimateMinutes: null, loggedMinutes: 0, sprint: null, pool: null, watching: false, project: { id: project.id, slug: project.slug, name: project.name, logoVersion: null },
  };
  const extra: [string, TaskStatus, Task["priority"], number, number][] = [
    [line("demoTask2", "Design the sign-in flow"), "DONE", "MEDIUM", 1, 40],
    [line("demoTask3", "Connect the GitHub repository"), "IN_REVIEW", "HIGH", 1, 22],
    [line("demoTask4", "Write the meeting guest link"), "IN_PROGRESS", "HIGH", 0, 15],
    [line("demoTask5", "Test file sharing in chat"), "TESTING", "MEDIUM", 2, 9],
    [line("demoTask6", "Prepare the first sprint"), "TODO", "LOW", 0, 5],
    [line("demoTask7", "Plan the release notes"), "TODO", "MEDIUM", 1, 3],
  ];
  const tasks: Task[] = [
    { ...task, status: "IN_PROGRESS" },
    ...extra.map(([title, status, priority, owner, age], index): Task => ({
      ...task, id: "pda-demo-task-" + (index + 2), taskNumber: index + 2, taskKey: "PDA-" + (index + 2), title, status, priority,
      creationMode: index % 2 ? "SIMPLE" : "ADVANCED", assigneeIds: [members[owner].userId], assignees: [people[owner]], updatedAt: before(age * 30),
    })),
  ];
  const connection: RepositoryConnection = {
    provider: "GITHUB", repositoryUrl: "https://github.com/pda/pda-student-platform", repositoryOwner: "pda", repositoryName: "pda-student-platform",
    defaultBranch: "main", trackingMode: "ADVANCED", notifyOnCommits: true, connectedBy: DEMO_USER.id, connectedAt: date, updatedAt: date,
  };
  const commit = (sha: string, message: string, author: string, age: number): Commit => ({
    sha: sha.repeat(8).slice(0, 40), shortSha: sha, message, author, authorLogin: author.toLowerCase(), authorAvatarUrl: null,
    committedAt: before(age), commitUrl: "https://github.com/pda/pda-student-platform/commit/" + sha.repeat(8).slice(0, 40),
  });
  const commits: Commit[] = [
    commit("a41f9c2", line("demoCommit1", "Add guest join link for meetings"), "Deniz", 18),
    commit("7be03d1", line("demoCommit2", "Share files in project chat"), "Ece", 95),
    commit("c92a5e7", line("demoCommit3", "Fix board column order"), "Alper", 260),
    commit("3d18b6f", line("demoCommit4", "Connect the repository settings"), "Deniz", 720),
    commit("e5740aa", line("demoCommit5", "Move task status to the sidebar"), "Ece", 1500),
  ];
  const featureCommits: Commit[] = [
    commit("b6c20f3", line("demoCommit6", "Add OAuth sign-in"), "Deniz", 36),
    commit("1f9ad48", line("demoCommit7", "Cover the sign-in flow with tests"), "Ece", 150),
    commits[3],
  ];
  const branches: RepositoryBranches = {
    truncated: false,
    branches: [
      { name: "main", isDefault: true, isProtected: true, headShortSha: commits[0].shortSha },
      { name: "feature/oauth-login", isDefault: false, isProtected: false, headShortSha: featureCommits[0].shortSha },
      { name: "fix/board-order", isDefault: false, isProtected: false, headShortSha: "9ac31e0" },
    ],
  };
  const compare: RepositoryCompare = { base: "main", branch: "feature/oauth-login", aheadBy: 2, behindBy: 1, unmergedCommits: featureCommits.slice(0, 2), truncated: false };
  return { project, home, team, members, roster, task, tasks, connection, commits, featureCommits, branches, compare, meetings: demoMeetings(text, project, people), messages: demoMessages(text, people) };
}

type Person = { userId: string; nickname: string };
function demoMeetings(text: Record<string, string>, project: Project, people: Person[]): Meeting[] {
  const base = {
    meetingType: "PROJECT" as const, project: { id: project.id, slug: project.slug, name: project.name, logoVersion: null, logoShape: "SQUARE" as const },
    organizerId: people[0].userId, organizer: { ...people[0], profilePhotoVersion: null }, attendees: people.slice(1).map(person => ({ ...person, profilePhotoVersion: null })),
    attendeeIds: people.slice(1).map(person => person.userId), zoneId: "UTC", description: "", agenda: [] as string[], overtime: false, chatRetained: false, version: 0,
    roomEpoch: 0, reconnectRequired: false, cleanupPending: false, endedAt: null, hidden: false,
  };
  return [
    { ...base, id: "pda-demo-meeting-live", title: text.demoMeeting1 ?? "Sprint planning", icon: "users", status: "OPEN", startsAt: before(12), endsAt: after(33), openedAt: before(12) },
    { ...base, id: "pda-demo-meeting-3", title: text.demoMeeting3 ?? "Retrospective", icon: "lightbulb", status: "SCHEDULED", meetingType: "INDEPENDENT", project: null, startsAt: after(60 * 26), endsAt: after(60 * 27), openedAt: null },
  ];
}

function demoMessages(text: Record<string, string>, people: Person[]): ChatMessage[] {
  const message = (id: number, sender: number, content: string, age: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
    id: "pda-demo-message-" + id, conversationId: "pda-demo-chat", content, createdAt: before(age), sender: { ...people[sender], profilePhotoVersion: null },
    replyTo: null, reactionVersion: "0", reactions: [], deliveryStatus: "READ", ...extra,
  });
  return [
    message(1, 1, text.demoChat1 ?? "The sign-in flow is ready, opening the pull request now.", 24, { reactions: [{ code: "THUMBS_UP", emoji: "\u{1F44D}", count: 2, reactedByCurrentUser: true }] }),
    message(2, 2, text.demoChat2 ?? "Test report is attached.", 18, { attachment: { id: "pda-demo-file", filename: text.demoFile ?? "test-report.pdf", contentType: "application/pdf", size: 184320 } }),
    message(3, 0, text.demoChat3 ?? "Great, let us merge it today.", 11, { reactions: [{ code: "HEART", emoji: "❤️", count: 1, reactedByCurrentUser: false }] }),
  ];
}
export type DemoData = ReturnType<typeof demoData>;
export function demoPage<T>(content: T[]) { return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 }; }

/** Exact query contracts, resolved locally. Unknown queries fail closed instead of reaching an API. */
export function resolveDemoQuery(key: readonly unknown[], data: DemoData): unknown {
  if (key[0] === "session") return DEMO_USER;
  if (key[0] === "organizations" && key[1] === "picker") return demoPage([]);
  if (key[0] === "tasks" && key[1] === "counts") return { open: 1, overdue: 0, dueSoon: 0, blocked: 0, poolAvailable: 0 };
  if (key[0] === "projects") {
    if (key[1] === "sidebar-default") return demoPage([data.project]);
    if (key[1] === "by-slug") return key[2] ? data.project : undefined;
    if (key[1] === "selected") return key[3] ? data.project : undefined;
    if (key[2] === "home") return data.home;
    if (key[2] === "members") return key[3] === "me" ? data.members[0] : key[3] === "all" ? data.members : demoPage(data.members);
    if (key[2] === "invitations") return demoPage([]);
    if (key[2] === "criteria" || key[2] === "labels" || key[2] === "sprints") return [];
    if (key[2] === "squads") {
      if (key.includes("members")) return data.roster;
      if (key[3] === "all") return [data.team];
      if (key[3] === data.team.id) return data.team;
      return demoPage([data.team]);
    }
    if (key[2] === "tasks") return key[3] === "all" ? data.tasks : key[3] === "list" ? demoPage(data.tasks) : undefined;
    if (key[2] === "repository") {
      if (key[3] === "branches") return data.branches;
      if (key[3] === "compare") return key[4] === data.compare.branch ? data.compare : undefined;
      if (key[3] === "commits") {
        if (key.includes("page")) return key[4] ? { commits: key[4] === data.compare.branch ? data.featureCommits : data.commits, hasNext: false } : undefined;
        return key[4] === null ? data.commits : undefined;
      }
    }
    if (key.includes("chat")) return { totalUnread: 0, conversations: [] };
  }
  return undefined;
}
