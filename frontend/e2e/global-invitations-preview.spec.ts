import { expect, test } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const api = "http://localhost:8080/api/v1";

test("global invitations show a recipient-owned project preview without an open link", async ({ page, context }) => {
  await context.addCookies([{ name: "PDA_SESSION", value: "ui-test", domain: "localhost", path: "/" }]);
  // The status query parameter of every list read: "PENDING" on the default tab, none on the history tab.
  const listFilters: (string | null)[] = [];
  await page.route(`${api}/**`, async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/auth/me")) {
      return json({ id: "user-1", email: "tester@example.test", nickname: "tester", globalRole: "USER", mustChangePassword: false });
    }
    if (url.pathname.endsWith("/project-invitations/me")) {
      listFilters.push(url.searchParams.get("status"));
      return json({ page: 0, size: 20, totalElements: 2, totalPages: 1, content: [
        { id, projectId, projectName: "Atlas", teamName: "Core", invitedBy: "manager-1", invitedByNickname: "manager",
          initialRoles: ["TESTER"], status: "PENDING", createdAt: "2026-10-01T12:00:00Z",
          expiresAt: "2026-10-08T12:00:00Z", message: "Katılmanı bekliyoruz" },
        { id: "33333333-3333-4333-8333-333333333333", projectId, projectName: "Arşiv", teamName: null,
          invitedBy: "manager-1", invitedByNickname: "manager", initialRoles: ["TESTER"], status: "REJECTED",
          createdAt: "2026-09-01T12:00:00Z", expiresAt: "2026-09-08T12:00:00Z", message: null },
      ] });
    }
    if (url.pathname.endsWith(`/${id}/preview`)) {
      return json({ projectId, slug: "atlas", name: "Atlas", tagline: "Proje özeti", description: "Açıklama",
        projectGoal: "Hedef", status: "PLANNING", projectType: "WEB", techStack: "React",
        memberCount: 3, updatedAt: "2026-10-01T12:00:00Z", logoVersion: null });
    }
    if (url.pathname.endsWith("/projects")) return json({ page: 0, size: 1, totalElements: 0, totalPages: 0, content: [] });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("/invitations");
  const row = page.getByRole("row").filter({ hasText: "Atlas" });
  await expect(row).toContainText("Core");
  await expect(row).toContainText("Core ekibine katılım daveti");
  await expect(row).toContainText("Katılmanı bekliyoruz");
  await expect(row).toContainText("manager");
  await expect(row).toContainText("Bekliyor");
  await expect(row).toContainText("2026");
  await row.getByRole("button", { name: /Atlas proje bilgilerini/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Proje özeti");
  await expect(dialog).toContainText("Planlama");
  await expect(dialog).toContainText("Web");
  await expect(dialog.getByRole("img", { name: "React" })).toBeVisible();
  await expect(dialog).toContainText("3 üye");
  await expect(dialog).toContainText("Son güncelleme");
  await expect(dialog.getByRole("link", { name: /Projeyi aç/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: "Arşiv" }).getByRole("button", { name: /Kabul et|Reddet/ })).toHaveCount(0);

  // Bekleyen is the default tab and asks for pending invitations only; Tümü asks for the whole history.
  expect(listFilters[0]).toBe("PENDING");
  await page.getByRole("tab", { name: "Tümü" }).click();
  await expect.poll(() => listFilters.at(-1)).toBeNull();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileList = page.getByRole("list", { name: /proje davetleri/i });
  await expect(mobileList).toBeVisible();
  await expect(mobileList).toContainText("Atlas");
  await expect(mobileList).toContainText("Core");
});

test("accept and reject keep the recipient list in sync and send an optional reason", async ({ page, context }) => {
  await context.addCookies([{ name: "PDA_SESSION", value: "ui-test", domain: "localhost", path: "/" }]);
  const invitations = [
    { id, projectId, projectName: "Atlas", teamName: "Core", invitedBy: "manager-1", invitedByNickname: "manager",
      initialRoles: ["TESTER"], status: "PENDING", createdAt: "2026-10-01T12:00:00Z",
      expiresAt: "2026-10-08T12:00:00Z", message: "Katıl" },
    { id: "33333333-3333-4333-8333-333333333333", projectId, projectName: "Bora", teamName: "Design",
      invitedBy: "manager-1", invitedByNickname: "manager", initialRoles: ["TESTER"], status: "PENDING",
      createdAt: "2026-10-01T12:00:00Z", expiresAt: "2026-10-08T12:00:00Z", message: null },
  ];
  let rejectionMessage: string | undefined;
  let listReads = 0;
  await page.route(`${api}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const origin = request.headers().origin ?? "http://localhost:3000";
    const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-XSRF-TOKEN" };
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path.endsWith("/auth/me")) return json({ id: "user-1", email: "tester@example.test", nickname: "tester", globalRole: "USER", mustChangePassword: false });
    if (path.endsWith("/auth/csrf")) return route.fulfill({ status: 200, contentType: "application/json",
      headers: { ...headers, "Set-Cookie": "XSRF-TOKEN=ui-test; Path=/" }, body: JSON.stringify({ headerName: "X-XSRF-TOKEN" }) });
    if (path.endsWith("/project-invitations/me")) {
      listReads += 1;
      return json({ page: 0, size: 20, totalElements: 2, totalPages: 1, content: invitations });
    }
    if (path.endsWith(`/${id}/accept`)) {
      invitations[0].status = "ACCEPTED";
      return json({});
    }
    if (path.endsWith(`/${invitations[1].id}/reject`)) {
      rejectionMessage = (request.postDataJSON() as { message: string }).message;
      invitations[1].status = "REJECTED";
      return route.fulfill({ status: 204, headers });
    }
    if (path.endsWith("/projects")) return json({ page: 0, size: 1, totalElements: 0, totalPages: 0, content: [] });
    return route.fulfill({ status: 404, headers });
  });

  await page.goto("/invitations");
  const atlas = page.getByRole("row").filter({ hasText: "Atlas" });
  await atlas.getByRole("button", { name: "Kabul et" }).click();
  await expect(atlas).toContainText("Kabul edildi");
  await expect(atlas.getByRole("button", { name: "Kabul et" })).toHaveCount(0);
  const bora = page.getByRole("row").filter({ hasText: "Bora" });
  await bora.getByRole("button", { name: "Reddet" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Şu an uygun değilim");
  await page.getByRole("dialog").getByRole("button", { name: "Reddet" }).click();
  await expect(bora).toContainText("Reddedildi");
  await expect(bora.getByRole("button", { name: "Reddet" })).toHaveCount(0);
  expect(rejectionMessage).toBe("Şu an uygun değilim");
  expect(listReads).toBeGreaterThanOrEqual(3);
});

test("list and preview show loading, error, retry and empty states", async ({ page, context }) => {
  test.setTimeout(60_000);
  await context.addCookies([{ name: "PDA_SESSION", value: "ui-test", domain: "localhost", path: "/" }]);
  let listMode: "error" | "success" | "empty" = "error";
  let previewMode: "error" | "success" = "error";
  await page.route(`${api}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/auth/me")) return json({ id: "user-1", email: "tester@example.test", nickname: "tester", globalRole: "USER", mustChangePassword: false });
    if (path.endsWith("/project-invitations/me")) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (listMode === "error") return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      const content = listMode === "empty" ? [] : [
        { id, projectId, projectName: "Atlas", teamName: "Core", invitedBy: "manager-1", invitedByNickname: "manager",
          initialRoles: ["TESTER"], status: "PENDING", createdAt: "2026-10-01T12:00:00Z",
          expiresAt: "2026-10-08T12:00:00Z", message: null },
      ];
      return json({ page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, content });
    }
    if (path.endsWith(`/${id}/preview`)) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (previewMode === "error") return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      return json({ projectId, slug: "atlas", name: "Atlas", tagline: "Proje özeti", description: null,
        projectGoal: null, status: "PLANNING", projectType: "WEB", techStack: null,
        memberCount: 1, updatedAt: "2026-10-01T12:00:00Z", logoVersion: null });
    }
    if (path.endsWith("/projects")) return json({ page: 0, size: 1, totalElements: 0, totalPages: 0, content: [] });
    return route.fulfill({ status: 404 });
  });

  await page.goto("/invitations");
  await expect(page.getByRole("status", { name: "Davetler yükleniyor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tekrar dene" })).toBeVisible();
  listMode = "success";
  await page.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Atlas" })).toBeVisible();

  await page.getByRole("row").filter({ hasText: "Atlas" }).getByRole("button", { name: /Atlas proje bilgilerini/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status", { name: "Proje bilgileri yükleniyor" })).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("Proje bilgileri yüklenemedi");
  previewMode = "success";
  await dialog.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(dialog).toContainText("Proje özeti");

  listMode = "empty";
  await page.reload();
  await expect(page.getByText("Bekleyen davetiniz yok.")).toBeVisible();
  await page.getByRole("tab", { name: "Tümü" }).click();
  await expect(page.getByText("Proje davetiniz yok.")).toBeVisible();
});
