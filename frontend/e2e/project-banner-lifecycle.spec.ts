import { test, expect } from "@playwright/test";
import { localizeHref } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";
import { createdProjectSlug, api, declineTeamPrompt, openProjectListPage } from "./helpers";
import { bannerInDatabase } from "./project-banner-db";
import { MANAGER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });

test("corrupt banner is reported while the previous valid preview and draft stay intact", async ({ page }) => {
  await page.goto("/projects/new");
  await page.locator("#project-name").fill("Banner draft QA");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 120; canvas.height = 40;
    canvas.getContext("2d")!.fillRect(0, 0, 120, 40); return canvas.toDataURL("image/png").split(",")[1];
  });
  const input = page.locator('input[type="file"]').nth(1);
  await input.setInputFiles({ name: "valid.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  const preview = page.locator('#project-preview img[src^="blob:"]');
  await expect(preview).toBeVisible();
  const before = await preview.getAttribute("src");
  await input.setInputFiles({ name: "corrupt.png", mimeType: "image/png", buffer: Buffer.from("not a decodable image") });
  await expect(page.locator("main p[role=alert]")).toBeVisible();
  await expect(preview).toHaveAttribute("src", before!);
  await expect(page.locator("#project-name")).toHaveValue("Banner draft QA");
});


test("banner replace/remove/reselect and late decode/unmount release local resources without uploading", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { created: [] as { url: string; name: string }[], revoked: [] as string[], release: undefined as (() => void) | undefined };
    Object.assign(window, { bannerProbe: state });
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL), decode = window.createImageBitmap.bind(window);
    URL.createObjectURL = blob => { const url = create(blob); state.created.push({ url, name: blob instanceof File ? blob.name : "blob" }); return url; };
    URL.revokeObjectURL = url => { state.revoked.push(url); revoke(url); };
    // TEST-ONLY delayed native decode completion; the selected image is still genuinely decoded.
    window.createImageBitmap = ((blob: Blob) => blob instanceof File && blob.name === "slow.png"
      ? new Promise<ImageBitmap>(resolve => { state.release = () => decode(blob).then(resolve); }) : decode(blob)) as typeof createImageBitmap;
  });
  await page.goto("/projects/new");
  const calls: string[] = [];
  page.on("request", request => { if (request.method() !== "GET" && /\/projects(?:\/[^/]+\/banner)?$/.test(new URL(request.url()).pathname)) calls.push(request.method()); });
  const png = Buffer.from(await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 24; c.height = 8; return c.toDataURL("image/png").split(",")[1]; }), "base64");
  const input = page.locator('input[type="file"]').nth(1), preview = page.locator('#project-preview img[src^="blob:"]');
  const choose = (name: string) => input.setInputFiles({ name, mimeType: "image/png", buffer: png });
  await choose("first.png"); await expect(preview).toBeVisible(); const first = await preview.getAttribute("src");
  await choose("second.png"); await expect(preview).not.toHaveAttribute("src", first!); const second = await preview.getAttribute("src");
  await expect.poll(() => page.evaluate(url => (window as unknown as { bannerProbe: { revoked: string[] } }).bannerProbe.revoked.includes(url!), first)).toBe(true);
  for (const file of [
    { name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) },
    { name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) },
    { name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") },
  ]) { await input.setInputFiles(file); await expect(page.locator("main p[role=alert]")).toBeVisible(); await expect(preview).toHaveAttribute("src", second!); }
  await choose("slow.png"); await expect(input).toHaveAttribute("aria-busy", "true");
  await choose("latest.png"); await expect(input).toHaveAttribute("aria-busy", "false"); const latest = await preview.getAttribute("src");
  await page.evaluate(() => (window as unknown as { bannerProbe: { release: () => void } }).bannerProbe.release());
  await expect(preview).toHaveAttribute("src", latest!);
  await page.getByRole("button", { name: "Kaldır", exact: true }).click(); await expect(preview).toHaveCount(0);
  await choose("latest.png"); await expect(preview).toBeVisible(); const last = await preview.getAttribute("src");
  await page.locator('.app-shell a[href="/tr/projeler"]').first().click();
  await expect(page).toHaveURL(/\/tr\/projeler$/);
  await expect.poll(() => page.evaluate(url => (window as unknown as { bannerProbe: { revoked: string[] } }).bannerProbe.revoked.includes(url!), last)).toBe(true);
  expect(calls).toEqual([]);
});

test("real create and banner upload persist bytes and version before the warm project card", async ({ page }) => {
 let id: string | undefined;
 try {
  await page.goto("/projects/new");
  const png = Buffer.from(await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 64; c.height = 16; c.getContext("2d")!.fillRect(0,0,64,16); return c.toDataURL("image/png").split(",")[1]; }), "base64");
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "persist.png", mimeType: "image/png", buffer: png });
  await expect(page.locator('#project-preview img[src^="blob:"]')).toBeVisible();
  await page.locator("#project-name").fill(`Persist banner QA ${Date.now()}`);
  await page.getByRole("radio", { name: /^Web/ }).click();
  const uploaded = page.waitForResponse(response => /\/projects\/[^/]+\/banner$/.test(new URL(response.url()).pathname) && response.request().method() === "PUT");
  await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
  expect((await uploaded).status()).toBe(204);
  await declineTeamPrompt(page);
  await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/genel-bakis$/);
  const slug = await createdProjectSlug(page);
  id = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
  expect(bannerInDatabase(id)).toEqual({ rows: 1, bytes: png.length, version: true });
  await openProjectListPage(page, slug);
  await expect(page.getByRole("article").filter({ has: page.locator(`a[href="/tr/projeler/${slug}/genel-bakis"]`) }).locator('img[src*="/banner?v="]')).toBeVisible();
 } finally { if (id) await api(page, "POST", `/projects/${id}/archive`); }
});


test("injected create/upload failures preserve the draft or the genuinely created project", async ({ page }) => {
 let id: string | undefined;
 try {
  await page.goto("/projects/new");
  const name = `Upload failure QA ${Date.now()}`;
  const png = Buffer.from(await page.evaluate(() => { const c = document.createElement("canvas"); c.width=24; c.height=8; return c.toDataURL("image/png").split(",")[1]; }), "base64");
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "fail.png", mimeType: "image/png", buffer: png });
  const preview = page.locator('#project-preview img[src^="blob:"]'); await expect(preview).toBeVisible(); const url = await preview.getAttribute("src");
  await page.locator("#project-name").fill(name); await page.getByRole("radio", { name: /^Web/ }).click();
  // TEST-ONLY negative transport faults. Successful create still goes to the real backend/DB.
  await page.route("**/api/v1/projects", route => route.request().method() === "POST" ? route.abort("failed") : route.continue());
  await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
  await expect(page.locator("#project-name")).toHaveValue(name); await expect(preview).toHaveAttribute("src", url!);
  await page.unroute("**/api/v1/projects");
  await page.route("**/api/v1/projects/*/banner", route => route.request().method() === "PUT" ? route.abort("failed") : route.continue());
  await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
  await declineTeamPrompt(page);
  await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/genel-bakis$/);
  await expect(page.locator('[data-sonner-toast][data-type="warning"]')).toBeVisible();
  const slug = await createdProjectSlug(page);
  const detail = await api(page, "GET", `/projects/by-slug/${slug}`); expect(detail.status).toBe(200);
  id = (detail.json as { id: string }).id;
  expect(bannerInDatabase(id)).toEqual({ rows: 0, bytes: 0, version: false });
 } finally { if(id) await api(page, "POST", `/projects/${id}/archive`); }
});


test("banner preview and decode errors fit five widths, both themes and three languages", async ({ page }) => {
 test.setTimeout(150_000);
 await page.emulateMedia({ reducedMotion: "reduce" });
 for (const locale of ["tr", "en", "de"] as const) for (const theme of ["light", "dark"]) for (const width of [320, 390, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(localizeHref("/projects/new", locale));
  // TEST-ONLY visual theme fixture. Actual selection/decoding/rendering remains unchanged.
  await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
  const labels = ({ tr, en, de })[locale].projects.newPage.banner;
  const png = Buffer.from(await page.evaluate(() => { const c=document.createElement("canvas"); c.width=120;c.height=40;return c.toDataURL("image/png").split(",")[1]; }), "base64");
  const input=page.locator('input[type="file"]').nth(1);
  await input.setInputFiles({ name: "matrix.png", mimeType: "image/png", buffer: png });
  const preview=page.locator('#project-preview img[src^="blob:"]');
  await expect(preview).toBeVisible(); await expect.poll(() => preview.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(120);
  const before=await preview.getAttribute("src");
  await input.setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("broken") });
  await expect(page.locator("main p[role=alert]").filter({ hasText: labels.invalidImage })).toBeVisible();
  await expect(preview).toHaveAttribute("src",before!);
  if(width<640) {
   const remove=page.getByRole("button",{name:labels.remove,exact:true});
   await expect.poll(async ()=>(await remove.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  if(locale==="tr") await page.screenshot({path:`../.local/project-invitations-create-implementation/task5-${theme}-${width}.png`,fullPage:true});
  await page.getByRole("button",{name:labels.remove,exact:true}).click();
 }
});
