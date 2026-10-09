import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { api } from "./helpers";
import { notificationFixture, openNotificationCenter } from "./notification-fixture";
import { notificationInDatabase } from "./notification-db";

test("repository link uses the guarded read operation and retains persisted history", async ({ browser }) => {
  const f = await notificationFixture(browser, 1);
  try {
    const note = f.notes[0];
    // TEST-ONLY snapshot fixture on this suite's own actual notification. All reads, navigation and mutations are real.
    if (![f.user.id, f.projectId, note.id].every(id => /^[a-f0-9-]{36}$/.test(id))) throw Error("Invalid QA UUID");
    const cid = execFileSync("docker", ["compose", "ps", "-q", "postgres"], { cwd: path.resolve(__dirname, "../.."), encoding: "utf8" }).trim();
    const args: string[] = JSON.parse(execFileSync("docker", ["inspect", "--format", "{{json .Config.Cmd}}", cid], { encoding: "utf8" }));
    const port = args.includes("-p") ? args[args.indexOf("-p") + 1] : "5432";
    const sql = `PREPARE repo_read_qa(uuid,uuid,uuid) AS UPDATE notifications SET type='REPOSITORY_COMMITS_PUSHED',resource_type='PROJECT',resource_id=$3,repo_project_name='Read state QA',repo_full_name='example/qa',repo_branch='main',repo_commit_count=1,repo_commits_truncated=false WHERE id=$1 AND recipient_user_id=$2 AND project_id=$3; EXECUTE repo_read_qa('${note.id}','${f.user.id}','${f.projectId}');`;
    execFileSync("docker", ["exec", cid, "sh", "-c", 'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -qAtc "$2"', "qa", port, sql], { encoding: "utf8" });
    const project = (await api(f.b, "GET", `/projects/${f.projectId}`)).json as { slug: string };
    await f.b.goto("/projects");
    const panel = await openNotificationCenter(f.b);
    const row = panel.locator(`[data-notification-id="${note.id}"]`);
    await expect(row).toContainText("example/qa");
    const read = f.b.waitForResponse(response => response.url().endsWith(`/notifications/${note.id}/read`) && response.request().method() === "PATCH");
    await row.getByRole("link", { name: "Depoyu aç", exact: true }).click();
    expect((await read).status()).toBe(200);
    await expect(f.b).toHaveURL(new RegExp(`/projeler/${project.slug}/depo`));
    expect(notificationInDatabase(f.user.id, note.id)).toMatchObject({ rowCount: 1, read: true, presentedAt: null });
    const center = await openNotificationCenter(f.b);
    await center.getByRole("tab", { name: "Geçmiş", exact: true }).click();
    await expect(center.locator(`[data-notification-id="${note.id}"]`)).toContainText("example/qa");
  } finally { await f.cleanup(); }
});
