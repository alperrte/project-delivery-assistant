import { test, expect, type Locator, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/**
 * Keyboard contract of the task comment boxes: Enter sends, Ctrl/Cmd+Enter inserts a line break at the caret,
 * Shift+Enter stays a native line break, IME composition and the @mention list win over sending, and on touch devices
 * Enter is a line break while the Send button sends.
 */
test.describe.configure({ mode: "serial" });
test.use({ storageState: MANAGER_STORAGE });

type Comment = { id: string; body: string | null };

let slug = "";
let projectId = "";
let memberNickname = "";

test.beforeAll(async ({ browser }) => {
  const manager = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
  slug = await createProject(manager, `Comment keys ${Date.now()}`);
  projectId = ((await api(manager, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;

  // A second person to mention: the author is not offered in their own suggestions.
  const member = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
  await member.goto("/projects");
  const me = (await api(member, "GET", "/auth/me")).json as { id: string; nickname: string };
  memberNickname = me.nickname;
  const team = await api(manager, "POST", `/projects/${projectId}/teams`, { name: "Comment keys team" });
  expect(team.status).toBe(201);
  const invite = await api(manager, "POST", `/projects/${projectId}/invitations`, {
    userId: me.id,
    roles: ["FRONTEND_DEVELOPER"],
    teamId: (team.json as { id: string }).id,
  });
  expect(invite.status).toBe(201);
  const { invitationId, token } = invite.json as { invitationId: string; token: string };
  expect((await api(member, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token })).status).toBe(200);
  await manager.context().close();
  await member.context().close();
});

async function createTask(page: Page, title: string) {
  await page.goto(`/projects/${slug}/tasks`);
  const created = await api(page, "POST", `/projects/${projectId}/tasks`, { title, priority: "MEDIUM", creationMode: "SIMPLE" });
  expect(created.status).toBe(201);
  return (created.json as { id: string }).id;
}

const composer = (page: Page) => page.getByRole("combobox", { name: "Yorum", exact: true });
const sendButton = (page: Page) => page.getByRole("button", { name: "Yorum yap", exact: true });

async function openTask(page: Page, title: string) {
  const id = await createTask(page, title);
  await page.goto(`/projects/${slug}/tasks/${id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(composer(page)).toBeVisible();
  return id;
}

/** Counts requests as they leave the page, so a double submit is caught even if the second one never completes. */
function countRequests(page: Page, method: string, pattern: RegExp) {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.method() === method && pattern.test(request.url())) seen.push(request.url());
  });
  return seen;
}

const settle = (page: Page) => page.waitForTimeout(400);

const comments = async (page: Page, taskId: string) =>
  ((await api(page, "GET", `/projects/${projectId}/tasks/${taskId}/comments`)).json as { content: Comment[] }).content;

test("Enter sends the comment once and clears the box", async ({ page }) => {
  const posts = countRequests(page, "POST", /\/comments$/);
  const taskId = await openTask(page, `Enter sends ${Date.now()}`);
  await expect(page.getByText("Enter ile gönder · Ctrl+Enter ile yeni satır")).toBeVisible();
  await expect(composer(page)).toHaveAccessibleDescription("Enter ile gönder · Ctrl+Enter ile yeni satır");

  await composer(page).fill("first comment");
  await composer(page).press("Enter");
  await expect(composer(page)).toHaveValue("");
  await expect(page.getByText("first comment", { exact: true })).toBeVisible();
  await settle(page);
  expect(posts).toHaveLength(1);
  expect((await comments(page, taskId)).map((comment) => comment.body)).toEqual(["first comment"]);
});

test("Ctrl+Enter inserts a new line at the caret and Enter then sends both lines", async ({ page }) => {
  const posts = countRequests(page, "POST", /\/comments$/);
  const taskId = await openTask(page, `Ctrl newline ${Date.now()}`);

  await composer(page).pressSequentially("line one");
  await composer(page).press("Control+Enter");
  await composer(page).pressSequentially("line two");
  await expect(composer(page)).toHaveValue("line one\nline two");
  await settle(page);
  expect(posts).toHaveLength(0);

  await composer(page).press("Enter");
  await expect(composer(page)).toHaveValue("");
  await expect(page.getByText("line two")).toBeVisible();
  await settle(page);
  expect(posts).toHaveLength(1);
  expect((await comments(page, taskId)).map((comment) => comment.body)).toEqual(["line one\nline two"]);
});

test("Ctrl+Enter breaks the line where the caret is, not at the end", async ({ page }) => {
  const posts = countRequests(page, "POST", /\/comments$/);
  await openTask(page, `Ctrl caret ${Date.now()}`);

  await composer(page).pressSequentially("abcd");
  await composer(page).press("ArrowLeft");
  await composer(page).press("ArrowLeft");
  await composer(page).press("Control+Enter");
  await expect(composer(page)).toHaveValue("ab\ncd");
  await composer(page).pressSequentially("X");
  await expect(composer(page)).toHaveValue("ab\nXcd");
  await settle(page);
  expect(posts).toHaveLength(0);
});

test("Shift+Enter keeps the native new line and does not send", async ({ page }) => {
  const posts = countRequests(page, "POST", /\/comments$/);
  await openTask(page, `Shift newline ${Date.now()}`);

  await composer(page).pressSequentially("up");
  await composer(page).press("Shift+Enter");
  await composer(page).pressSequentially("down");
  await expect(composer(page)).toHaveValue("up\ndown");
  await settle(page);
  expect(posts).toHaveLength(0);
});

test("Enter on an empty or whitespace-only comment sends nothing", async ({ page }) => {
  const posts = countRequests(page, "POST", /\/comments$/);
  const taskId = await openTask(page, `Blank ${Date.now()}`);

  await composer(page).press("Enter");
  await composer(page).fill("   ");
  await composer(page).press("Enter");
  await settle(page);
  expect(posts).toHaveLength(0);
  expect(await comments(page, taskId)).toHaveLength(0);
});

test("Enter while an input method is composing does not send", async ({ page }) => {
  const posts = countRequests(page, "POST", /\/comments$/);
  await openTask(page, `IME ${Date.now()}`);

  await composer(page).fill("composing text");
  const prevented = await composer(page).evaluate((element) =>
    // dispatchEvent returns false when a handler called preventDefault.
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true })),
  );
  expect(prevented).toBe(true);
  await settle(page);
  expect(posts).toHaveLength(0);
  await expect(composer(page)).toHaveValue("composing text");
});

test("Enter picks the highlighted @mention and does not send", async ({ page }) => {
  const posts = countRequests(page, "POST", /\/comments$/);
  await openTask(page, `Mention ${Date.now()}`);

  await composer(page).pressSequentially(`hello @${memberNickname.slice(0, 6)}`);
  await expect(page.getByRole("option", { name: new RegExp(memberNickname) })).toBeVisible();
  await composer(page).press("Enter");
  await expect(composer(page)).toHaveValue(`hello @${memberNickname} `);
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await settle(page);
  expect(posts).toHaveLength(0);

  // The list is closed now, so the next Enter sends.
  await composer(page).press("Enter");
  await expect(composer(page)).toHaveValue("");
  await expect.poll(() => posts.length).toBe(1);
});

test("on a touch device Enter is a new line and the Send button sends", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: MANAGER_STORAGE,
    locale: "tr-TR",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    const posts = countRequests(page, "POST", /\/comments$/);
    const taskId = await openTask(page, `Touch ${Date.now()}`);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse) and (hover: none)").matches)).toBe(true);
    await expect(page.getByText("Göndermek için Gönder düğmesini kullanın")).toBeVisible();
    await expect(composer(page)).toHaveAccessibleDescription("Göndermek için Gönder düğmesini kullanın");

    await composer(page).fill("touch one");
    await composer(page).press("Enter");
    await composer(page).pressSequentially("touch two");
    await expect(composer(page)).toHaveValue("touch one\ntouch two");
    await settle(page);
    expect(posts).toHaveLength(0);

    await sendButton(page).tap();
    await expect(composer(page)).toHaveValue("");
    await settle(page);
    expect(posts).toHaveLength(1);
    expect((await comments(page, taskId)).map((comment) => comment.body)).toEqual(["touch one\ntouch two"]);
  } finally {
    await context.close();
  }
});

test("editing a comment: Enter saves once, Ctrl+Enter adds a line", async ({ page }) => {
  const patches = countRequests(page, "PATCH", /\/comments\/[^/]+$/);
  const taskId = await openTask(page, `Edit ${Date.now()}`);
  expect((await api(page, "POST", `/projects/${projectId}/tasks/${taskId}/comments`, { body: "before edit" })).status).toBe(201);
  await page.reload();
  await expect(page.getByText("before edit", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Yorumu düzenle", exact: true }).click();
  const editor: Locator = page.getByRole("combobox", { name: "Yorumu düzenle", exact: true });
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("before edit");
  await editor.press("Control+End");
  await editor.press("Control+Enter");
  await editor.pressSequentially("after edit");
  await expect(editor).toHaveValue("before edit\nafter edit");
  await settle(page);
  expect(patches).toHaveLength(0);

  await editor.press("Enter");
  await expect(editor).toHaveCount(0);
  await expect(page.getByText("after edit")).toBeVisible();
  await settle(page);
  expect(patches).toHaveLength(1);
  expect((await comments(page, taskId)).map((comment) => comment.body)).toEqual(["before edit\nafter edit"]);
});
