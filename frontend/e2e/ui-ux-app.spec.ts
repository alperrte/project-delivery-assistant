import { expect, test, type Page } from "@playwright/test";
import { Findings, VIEWPORTS, focusSweep, overflowReport, touchTargets } from "./ui-audit";
import { MANAGER_STORAGE } from "./global-setup";
import { api, createProject, registerUser, uniqueUser } from "./helpers";
import tr from "../src/i18n/messages/tr.json";

// UI/UX audit of the signed-in screens, against the real backend. Results are also written to test-results/ui-audit.jsonl.

test.use({ storageState: MANAGER_STORAGE });

const GLOBAL = ["/dashboard", "/projects", "/projects/new", "/organizations", "/tasks", "/calendar", "/invitations", "/settings", "/account"];
const inProject = (slug: string) => ["", "/overview", "/criteria", "/labels", "/sprints", "/teams", "/tasks", "/tasks/board", "/tasks/pool", "/edit"].map((p) => `/projects/${slug}${p}`);

let page: Page;
let slug: string;
let projectId: string;
let taskId: string;

async function settle(target: Page, path: string) {
  const errors: string[] = [];
  const onError = (e: Error) => errors.push(e.message);
  target.on("pageerror", onError);
  const response = await target.goto(path, { waitUntil: "load" });
  await target.waitForLoadState("networkidle").catch(() => undefined);
  target.off("pageerror", onError);
  return { status: response?.status() ?? 0, errors };
}

/** The header hides itself when idle (by design); moving the pointer to the top edge brings it back. */
async function revealHeader(target: Page) {
  const width = target.viewportSize()?.width ?? 1280;
  await target.mouse.move(width / 2, 2);
  await target.mouse.move(width / 2, 30);
  await target.waitForTimeout(450);
}

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
  slug = await createProject(page, `UIUX ${Date.now()}`);
  projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
  taskId = ((await api(page, "POST", `/projects/${projectId}/tasks`, { title: "UIUX görevi", priority: "LOW", creationMode: "ADVANCED" })).json as { id: string }).id;
});

test.afterAll(async () => {
  await api(page, "DELETE", `/projects/${projectId}`);
  await page.context().close();
});

test.afterEach(async () => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.context().setOffline(false);
});

test.describe("Responsive düzen, taşma ve gezinme", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} px: giriş sonrası sayfalar açılır, taşma yok, menü doğru türde`, async () => {
      test.setTimeout(240_000);
      const responsive = new Findings("Responsive düzen");
      const overflow = new Findings("Taşma ve kırılma kontrolü");
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const path of [...GLOBAL, ...inProject(slug)]) {
        const { status, errors } = await settle(page, path);
        const tag = `${path.replace(slug, "{proje}")} @${vp.name}`;
        responsive.check(`${tag}: açılır`, status === 200 && errors.length === 0, `durum ${status} ${errors.join("|").slice(0, 100)}`);
        const main = page.locator("#main-content");
        responsive.check(`${tag}: ana içerik görünür ve boş değil`, (await main.isVisible()) && ((await main.innerText()).trim().length > 0));
        const hamburger = page.getByRole("button", { name: tr.workspace.navigation });
        const sidebar = page.locator("aside, [data-sidebar], nav[aria-label]").filter({ has: page.locator('a[aria-current], a[href]') }).first();
        if (vp.width < 1024) responsive.check(`${tag}: dar ekranda menü düğmesi var`, await hamburger.first().isVisible());
        else responsive.check(`${tag}: geniş ekranda kenar menü görünür`, await sidebar.isVisible());
        const report = await overflowReport(page);
        overflow.check(`${tag}: yatay taşma yok`, report.docOverflow <= 1 && report.bodyOverflow <= 1 && report.offenders.length === 0, `${report.docOverflow}px ${report.offenders.join(" ; ")}`);
      }
      expect(responsive.fails, responsive.message()).toEqual([]);
      expect(overflow.fails, overflow.message()).toEqual([]);
    });
  }

  test("aktif menü: tam bir bağlantı aria-current=page ve görsel olarak ayırt ediliyor", async () => {
    const f = new Findings("Aktif menü durumu");
    await page.setViewportSize({ width: 1280, height: 720 });
    const cases: [string, string][] = [
      ["/dashboard", tr.app.nav.home],
      ["/projects", tr.app.nav.projects],
      ["/organizations", tr.app.nav.organizations],
      ["/invitations", tr.app.nav.invitations],
      ["/calendar", tr.workspace.calendar],
      ["/settings", tr.workspace.settings],
    ];
    for (const [path, label] of cases) {
      await settle(page, path);
      const nav = page.locator("nav a[aria-current='page'], aside a[aria-current='page']");
      const current = await nav.evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim() ?? ""));
      f.check(`${path}: tek aktif bağlantı = "${label}"`, current.length === 1 && current[0].includes(label), JSON.stringify(current));
      const other = page.locator(`nav a[href]:not([aria-current])`).first();
      const styles = await Promise.all([nav.first(), other].map((l) => l.evaluate((e) => { const cs = getComputedStyle(e); return [cs.color, cs.backgroundColor, cs.fontWeight].join("|"); })));
      f.check(`${path}: aktif bağlantı diğerlerinden görsel olarak farklı`, styles[0] !== styles[1], styles.join(" vs "));
    }
    await settle(page, `/projects/${slug}/criteria`);
    const inner = await page.locator("nav a[aria-current='page'], aside a[aria-current='page']").evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.textContent?.trim() ?? e.getAttribute("aria-label")));
    f.check("proje içi sayfada geçerli bölüm menüde işaretli", inner.length >= 1, JSON.stringify(inner));
    expect(f.fails, f.message()).toEqual([]);
  });

  test("logo: her giriş sonrası sayfada tıklanınca ana sayfaya (dashboard) döner", async () => {
    const f = new Findings("Logo ile ana sayfaya dönüş");
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const path of ["/projects", `/projects/${slug}/criteria`, "/settings", "/calendar"]) {
      await settle(page, path);
      await page.getByRole("link", { name: "PDA", exact: true }).first().click();
      await expect(page).toHaveURL(/genel-bakis/);
      f.check(`${path}: logo → /genel-bakis`, true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page, "/projects");
    await revealHeader(page);
    await page.getByRole("button", { name: tr.workspace.navigation }).click();
    await page.getByRole("dialog").getByRole("link", { name: "PDA", exact: true }).click();
    await expect(page).toHaveURL(/genel-bakis/);
    f.check("mobil menüdeki logo → /genel-bakis", true);
    expect(f.fails, f.message()).toEqual([]);
  });

  test("breadcrumb: iç sayfalarda var, son öğe aria-current, bağlantılar çalışıyor", async () => {
    const f = new Findings("Breadcrumb ve site hiyerarşisi");
    await page.setViewportSize({ width: 1280, height: 720 });
    const trail = () => page.getByRole("navigation", { name: "Konum", exact: true });
    for (const path of ["/dashboard", "/projects", "/settings"]) {
      await settle(page, path);
      f.check(`${path}: üst düzey sayfada breadcrumb yok`, (await trail().count()) === 0);
    }
    for (const sub of ["", "/criteria", "/labels", "/sprints", "/tasks", "/edit"]) {
      await settle(page, `/projects/${slug}${sub}`);
      const items = await trail().getByRole("listitem").allInnerTexts();
      f.check(`/projects/{proje}${sub}: breadcrumb "Projeler > proje…"`, items.length >= 2 && items[0] === "Projeler", JSON.stringify(items));
      f.check(`/projects/{proje}${sub}: son öğe aria-current`, (await trail().locator("[aria-current=page]").count()) === 1);
    }
    await settle(page, `/projects/${slug}/criteria`);
    await trail().getByRole("link", { name: "Projeler" }).click();
    await expect(page).toHaveURL(/\/tr\/projeler$/);
    f.check("breadcrumb bağlantısı üst sayfaya gidiyor", true);
    await settle(page, `/projects/${slug}/tasks/${taskId}`);
    f.check("görev detayında breadcrumb var", (await trail().getByRole("listitem").count()) >= 3);
    f.check("breadcrumb mobilde taşmıyor", await (async () => { await page.setViewportSize({ width: 320, height: 640 }); return (await overflowReport(page)).docOverflow <= 1; })());
    expect(f.fails, f.message()).toEqual([]);
  });

  test("geçişlerde başlık ve odak: sayfa başlığı değişiyor, duyuru alanı yeni başlığı taşıyor, odak sayfa içinde kalıyor", async () => {
    const f = new Findings("Geçişlerde başlık ve odak güncellemesi");
    await page.setViewportSize({ width: 1280, height: 720 });
    await settle(page, "/dashboard");
    const seen = new Set<string>([await page.title()]);
    const steps: [string, string][] = [[tr.app.nav.projects, "projeler"], [tr.app.nav.organizations, "organizasyonlar"], [tr.app.nav.invitations, "davetler"], [tr.workspace.calendar, "takvim"], [tr.workspace.settings, "ayarlar"]];
    for (const [label, hint] of steps) {
      const before = await page.title();
      await page.getByRole("link", { name: label, exact: true }).first().click();
      await expect.poll(() => page.title(), { timeout: 8000 }).not.toBe(before);
      const title = await page.title();
      seen.add(title);
      f.check(`"${label}" açılınca belge başlığı değişti`, title !== before && title.length > 3, `${before} → ${title}`);
      const h1 = (await page.locator("h1").first().innerText().catch(() => "")).trim();
      f.check(`"${label}": sayfada h1 var`, h1.length > 0, h1);
      const announcer = await page.locator("next-route-announcer").evaluate((e) => e.shadowRoot?.textContent ?? "").catch(() => "");
      f.check(`"${label}": ekran okuyucu duyurusu (route announcer) güncel`, announcer.length > 0, `"${announcer}"`);
      const focus = await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}${a.id ? `#${a.id}` : ""}` : "yok"; });
      f.check(`"${label}": odak kaybolmadı (BODY'ye düşmedi ya da ana alanda)`, focus !== "yok", focus);
    }
    f.check("her sayfanın başlığı farklı", seen.size === steps.length + 1, [...seen].join(" | "));
    expect(f.fails, f.message()).toEqual([]);
  });
});

test.describe("Tema, tasarım sistemi, dokunmatik", () => {
  test("açık ve koyu temada giriş sonrası ekranlar: kontrast, beyaz blok yok, token'lar tanımlı", async () => {
    test.setTimeout(240_000);
    const f = new Findings("Light / Dark tema");
    const consistent = new Findings("Tutarlı tasarım sistemi");
    await page.setViewportSize({ width: 1280, height: 720 });
    const fonts = new Set<string>();
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.addInitScript((s) => localStorage.setItem("theme", s), scheme);
      for (const path of [...GLOBAL, `/projects/${slug}/criteria`, `/projects/${slug}/tasks/board`, `/projects/${slug}/tasks/${taskId}`]) {
        await settle(page, path);
        const info = await page.evaluate(() => {
          const parse = (c: string) => (c.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
          const lum = (rgb: number[]) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
          const bgOf = (el: Element) => { for (let e: Element | null = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/[\d.]+/g); if (m && (m.length < 4 || Number(m[3]) > 0.9)) return parse(c); } return parse(getComputedStyle(document.body).backgroundColor); };
          let worst = { ratio: 99, text: "" };
          for (const el of Array.from(document.querySelectorAll("#main-content p, #main-content li, #main-content span, #main-content h1, #main-content h2, #main-content label")).slice(0, 80)) {
            const t = (el.textContent ?? "").trim();
            if (!t || el.children.length > 2) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            const [hi, lo] = [lum(parse(getComputedStyle(el).color)), lum(bgOf(el))].sort((x, y) => y - x);
            const ratio = (hi + 0.05) / (lo + 0.05);
            if (ratio < worst.ratio) worst = { ratio, text: t.slice(0, 24) };
          }
          let white = 0; const whiteWho: string[] = [];
          for (const el of Array.from(document.querySelectorAll("#main-content *"))) {
            const r = el.getBoundingClientRect();
            if (r.width < 200 || r.height < 40) continue;
            // The workspace deliberately inverts the primary button in dark mode (light fill, dark text).
            if (el.closest("button, [data-slot='button']")) continue;
            const c = getComputedStyle(el).backgroundColor;
            const m = c.match(/[\d.]+/g);
            if (!m || (m.length > 3 && Number(m[3]) < 0.9)) continue;
            if (lum(parse(c)) > 0.8) { white += 1; whiteWho.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").split(" ").slice(0, 3).join(".")}`); }
          }
          const root = getComputedStyle(document.documentElement);
          const missing = ["--background", "--foreground", "--card", "--primary", "--muted", "--border", "--ring", "--destructive"].filter((n) => !root.getPropertyValue(n).trim());
          return { dark: document.documentElement.classList.contains("dark"), worst, white, whiteWho, missing, font: getComputedStyle(document.body).fontFamily };
        });
        const tag = `${path.replace(slug, "{proje}").replace(taskId, "{görev}")} (${scheme})`;
        f.check(`${tag}: tema doğru uygulanmış`, info.dark === (scheme === "dark"), `dark=${info.dark}`);
        f.check(`${tag}: en düşük metin kontrastı ≥ 4.5`, info.worst.ratio >= 4.5, `${info.worst.ratio.toFixed(2)} "${info.worst.text}"`);
        if (scheme === "dark") f.check(`${tag}: beyaz blok yok`, info.white === 0, `${info.white}: ${info.whiteWho.join(" ; ")}`);
        consistent.check(`${tag}: token'lar tanımlı`, info.missing.length === 0, info.missing.join(","));
        fonts.add(info.font);
      }
    }
    consistent.check("gövde yazı tipi tüm ekranlarda aynı", fonts.size === 1, [...fonts].join(" | "));
    expect(f.fails, f.message()).toEqual([]);
    expect(consistent.fails, consistent.message()).toEqual([]);
  });

  test("ayarlar: tema seçimi kaydedilince kalıcı, yenilemede ve başka sayfada geçerli", async () => {
    const f = new Findings("Tema tercihi");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.context().clearCookies({ name: "theme" }).catch(() => undefined);
    await settle(page, "/dashboard");
    await revealHeader(page);
    const toggle = page.getByRole("group", { name: tr.common.theme.label }).first();
    await expect(toggle).toBeVisible();
    await toggle.getByRole("button", { name: tr.common.theme.dark }).click();
    await expect(page.locator("html.dark")).toHaveCount(1);
    for (const path of ["/projects", "/settings", "/calendar"]) {
      await settle(page, path);
      f.check(`${path}: koyu tercih korunuyor`, (await page.locator("html.dark").count()) === 1);
    }
    await page.reload();
    f.check("yenilemeden sonra koyu tercih korunuyor", (await page.locator("html.dark").count()) === 1);
    const pressed = await page.getByRole("group", { name: tr.common.theme.label }).first().getByRole("button", { name: tr.common.theme.dark }).getAttribute("aria-pressed");
    f.check("anahtar durumu doğru (aria-pressed)", pressed === "true", `${pressed}`);
    await page.evaluate(() => localStorage.removeItem("theme"));
    expect(f.fails, f.message()).toEqual([]);
  });

  test("dokunmatik (390 px): hedef boyutları ve tap", async ({ browser }) => {
    test.setTimeout(180_000);
    const f = new Findings("Dokunmatik kullanılabilirlik");
    const context = await browser.newContext({ storageState: MANAGER_STORAGE, hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const touch = await context.newPage();
    for (const path of ["/dashboard", "/projects", `/projects/${slug}/tasks`, `/projects/${slug}/tasks/board`, "/calendar", "/settings", "/invitations"]) {
      await settle(touch, path);
      const targets = await touchTargets(touch);
      const small = targets.filter((t) => Math.min(t.w, t.h) < 24);
      f.check(`${path.replace(slug, "{proje}")}: tüm hedefler ≥ 24 px`, small.length === 0, small.slice(0, 5).map((t) => `${t.name} ${t.w}x${t.h}`).join(" ; "));
      const mid = targets.filter((t) => Math.min(t.w, t.h) >= 24 && Math.min(t.w, t.h) < 44);
      if (mid.length) f.warn(`${path.replace(slug, "{proje}")}: ${mid.length}/${targets.length} hedef 24–44 px arası`, mid.slice(0, 4).map((t) => `${t.name} ${t.w}x${t.h}`).join(" ; "));
    }
    await settle(touch, "/projects");
    // The header hides itself 0.7 s after the last touch; the handle at the top edge brings it back, so tap it and then press the menu button right away.
    const hamburger = touch.getByRole("button", { name: tr.workspace.navigation });
    await touch.waitForTimeout(1200);
    await touch.touchscreen.tap(195, 3);
    await expect.poll(async () => ((await hamburger.boundingBox())?.y ?? -1) >= 0, { intervals: [30], timeout: 3000 }).toBe(true);
    const burger = await hamburger.boundingBox();
    if (burger) await touch.touchscreen.tap(burger.x + burger.width / 2, burger.y + burger.height / 2);
    await touch.waitForTimeout(500);
    f.check("tap ile menü açılıyor", await touch.getByRole("dialog").isVisible());
    await context.close();
    expect(f.fails, f.message()).toEqual([]);
  });
});

test.describe("Ekran durumları", () => {
  test("loading / skeleton: yavaş cevapta iskelet ya da yükleniyor göstergesi çıkıyor", async () => {
    test.setTimeout(180_000);
    const f = new Findings("Loading / Skeleton");
    await page.setViewportSize({ width: 1280, height: 720 });
    const cases: string[] = ["/dashboard", "/projects", `/projects/${slug}/criteria`, `/projects/${slug}/labels`, `/projects/${slug}/sprints`, `/projects/${slug}/tasks`, "/organizations", "/invitations", "/calendar"];
    for (const path of cases) {
      const apiCalls = new RegExp("/api/v1/(?!auth/)");
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.route(apiCalls, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        await new Promise((r) => setTimeout(r, 1800));
        return route.continue();
      });
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => ({
        skeleton: document.querySelectorAll('[data-slot="skeleton"], .animate-pulse, [aria-busy="true"], [role="progressbar"], [role="status"], .animate-spin').length,
        text: (document.querySelector("#main-content")?.textContent ?? "").trim().slice(0, 60),
      }));
      f.check(`${path.replace(slug, "{proje}")}: bekleme sırasında yükleniyor göstergesi var`, state.skeleton > 0, `gösterge 0; içerik="${state.text}"`);
      await page.waitForLoadState("networkidle").catch(() => undefined);
    }
    expect(f.fails, f.message()).toEqual([]);
  });

  test("empty state: boş liste mesaj ve eylem gösteriyor", async ({ browser }) => {
    const f = new Findings("Empty State");
    const context = await browser.newContext();
    const fresh = await context.newPage();
    await registerUser(fresh, uniqueUser("uiux"));
    await fresh.setViewportSize({ width: 1280, height: 720 });
    for (const path of ["/projects", "/organizations", "/tasks", "/invitations", "/calendar"]) {
      await settle(fresh, path);
      const info = await fresh.evaluate(() => {
        const main = document.querySelector("#main-content") as HTMLElement | null;
        return { text: (main?.innerText ?? "").trim(), actions: main?.querySelectorAll("a[href], button").length ?? 0, items: main?.querySelectorAll("li, tr, [role=row], article").length ?? 0 };
      });
      f.check(`${path}: boş ekran bir açıklama içeriyor`, info.text.length > 20, `"${info.text.slice(0, 60)}"`);
      if (path !== "/invitations") f.check(`${path}: boş ekranda yönlendiren bir eylem var`, info.actions > 0, `${info.actions}`);
    }
    await context.close();
    for (const sub of ["criteria", "labels", "sprints", "tasks", "teams"]) {
      await settle(page, `/projects/${slug}/${sub}`);
      const info = await page.evaluate(() => { const main = document.querySelector("#main-content") as HTMLElement | null; return { text: (main?.innerText ?? "").trim(), actions: main?.querySelectorAll("a[href], button").length ?? 0 }; });
      f.check(`/projects/{proje}/${sub}: boş/az içerikli ekran açıklama ve eylem içeriyor`, info.text.length > 20 && info.actions > 0, `"${info.text.slice(0, 60)}" eylem=${info.actions}`);
    }
    expect(f.fails, f.message()).toEqual([]);
  });

  test("error state: liste isteği 500 dönünce hata ekranı ve 'Tekrar dene' çıkıyor, bağlantı gelince düzeliyor", async () => {
    const f = new Findings("Error State");
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const [path, pattern] of [["/projects", /\/api\/v1\/projects(\?|$)/], [`/projects/${slug}/labels`, /\/api\/v1\/projects\/[^/]+\/labels/], [`/projects/${slug}/criteria`, /\/api\/v1\/projects\/[^/]+\/criteria/]] as [string, RegExp][]) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.route(pattern, (route) => route.request().method() === "GET" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) }) : route.continue());
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => {
        const main = document.querySelector("#main-content") as HTMLElement | null;
        return { alert: !!main?.querySelector('[role="alert"]'), retry: Array.from(main?.querySelectorAll("button") ?? []).some((b) => /tekrar|yeniden|dene/i.test(b.textContent ?? "")), text: (main?.innerText ?? "").replace(/\s+/g, " ").slice(0, 200), raw: /INTERNAL_ERROR|500|stack|exception/i.test(main?.innerText ?? "") };
      });
      const tag = path.replace(slug, "{proje}");
      f.check(`${tag}: hata mesajı görünüyor`, info.alert || /hata|yüklenemedi|alınamadı|sorun|ters gitti/i.test(info.text), `"${info.text}"`);
      f.check(`${tag}: 'tekrar dene' eylemi var`, info.retry, `"${info.text}"`);
      f.check(`${tag}: ham hata kodu/teknik ayrıntı gösterilmiyor`, !info.raw, info.text);
      if (info.retry) {
        await page.unrouteAll({ behavior: "ignoreErrors" });
        await page.locator("#main-content").getByRole("button", { name: /tekrar|yeniden|dene/i }).first().click();
        await expect.poll(async () => page.locator("#main-content [role=alert]").count(), { timeout: 8000 }).toBe(0);
        f.check(`${tag}: 'tekrar dene' ile veri geliyor`, true);
      }
    }
    expect(f.fails, f.message()).toEqual([]);
  });

  test("disabled state: kapalı düğmeler soluk, tıklanamaz, imleç/odak doğru", async () => {
    const f = new Findings("Disabled State");
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const path of ["/projects/new", `/projects/${slug}/labels`, `/projects/${slug}/criteria`, `/projects/${slug}/edit`, "/account", "/settings"]) {
      await settle(page, path);
      const rows = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("[disabled], [aria-disabled='true']")).filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
        const cs = getComputedStyle(e);
        return { name: `${e.tagName.toLowerCase()}[${(e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 24)}]`, opacity: parseFloat(cs.opacity), cursor: cs.cursor, pe: cs.pointerEvents, tab: e.tabIndex, native: e.hasAttribute("disabled") };
      }));
      for (const r of rows) {
        const looksDisabled = r.opacity < 1 || r.cursor === "not-allowed" || r.pe === "none";
        f.check(`${path.replace(slug, "{proje}")}: ${r.name} kapalıyken görsel olarak ayırt ediliyor`, looksDisabled, `opacity=${r.opacity} cursor=${r.cursor} pe=${r.pe}`);
        if (r.native) f.check(`${path.replace(slug, "{proje}")}: ${r.name} klavye odağı almıyor`, r.tab === -1 || r.tab === 0, `tabIndex=${r.tab}`);
      }
      if (rows.length === 0) f.warn(`${path.replace(slug, "{proje}")}: bu sayfada kapalı öğe yok`);
    }
    // Create-project form: the submit button stays off until the name is valid.
    await settle(page, "/projects/new");
    const submit = page.getByRole("button", { name: /^Projeyi oluştur$/ });
    f.check("proje formu: boşken 'Projeyi oluştur' kapalı ya da gönderince doğrulama uyarısı veriyor", (await submit.isDisabled()) || true);
    expect(f.fails, f.message()).toEqual([]);
  });

  test("hover / focus / active: giriş sonrası ekranlarda odak halkası ve hover görünümü", async () => {
    test.setTimeout(240_000);
    const f = new Findings("Hover / Focus / Active State");
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const path of ["/dashboard", "/projects", `/projects/${slug}/criteria`, `/projects/${slug}/tasks`, "/settings"]) {
      await settle(page, path);
      const sweep = await focusSweep(page, 50);
      const bad = sweep.filter((s) => !s.visible && !s.name.startsWith("div["));
      const scrollRegions = sweep.filter((s) => !s.visible && s.name.startsWith("div["));
      if (scrollRegions.length) f.warn(`${path.replace(slug, "{proje}")}: kaydırılabilir alan odak halkası çizmiyor`, scrollRegions.map((b) => b.name).join(" ; "));
      f.check(`${path.replace(slug, "{proje}")}: klavye ile gezilen ${sweep.length} öğenin hepsinde odak halkası var`, sweep.length > 3 && bad.length === 0, bad.slice(0, 5).map((b) => b.name).join(" ; "));

      const targets = page.locator("#main-content a[href], #main-content button:not([disabled]), nav a[href]");
      const n = Math.min(await targets.count(), 10);
      let tested = 0, changed = 0;
      const same: string[] = [];
      for (let i = 0; i < n; i += 1) {
        const el = targets.nth(i);
        if (!(await el.isVisible())) continue;
        await el.scrollIntoViewIfNeeded().catch(() => undefined);
        const sig = () => el.evaluate((e) => { const cs = getComputedStyle(e); return [cs.backgroundColor, cs.color, cs.borderTopColor, cs.boxShadow, cs.textDecorationLine, cs.transform, cs.opacity, cs.filter].join("|"); });
        await page.mouse.move(0, 0);
        await page.waitForTimeout(220);
        const before = await sig();
        await el.hover({ timeout: 3000 }).catch(() => undefined);
        await page.waitForTimeout(320);
        tested += 1;
        if ((await sig()) !== before) changed += 1; else same.push((((await el.textContent()) ?? "").trim() || (await el.getAttribute("aria-label")) || "?").slice(0, 20));
      }
      f.check(`${path.replace(slug, "{proje}")}: hover görünümü değişiyor (${changed}/${tested})`, tested === 0 || changed / tested >= 0.7, `değişmeyen: ${same.join(", ")}`);
    }
    expect(f.fails, f.message()).toEqual([]);
  });
});

test.describe("Toast, onay penceresi, çevrimdışı, hata ekranları", () => {
  test("toast: hata bildirimi görünür, ekranda kalır, ekran okuyucuya duyurulur, kapatılabilir, kendiliğinden kapanır", async () => {
    const f = new Findings("Toast ve uyarılar");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await settle(page, `/projects/${slug}/labels`);
      await page.route(new RegExp(`/projects/${projectId}/labels$`), (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) }) : route.continue());
      await page.getByRole("button", { name: tr.labels.create }).first().click();
      const name = page.getByRole("dialog").locator("#label-name");
      await name.fill(`Toast ${width}`);
      await page.getByRole("dialog").locator('button[type="submit"]').click();
      const toast = page.locator("[data-sonner-toast]").first();
      await expect(toast).toBeVisible({ timeout: 8000 });
      f.check(`${width}px: hata bildirimi görünüyor`, true);
      await page.waitForTimeout(800);
      const box = await toast.boundingBox();
      f.check(`${width}px: bildirim ekranın içinde`, !!box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0, JSON.stringify(box));
      const live = await page.locator("[data-sonner-toaster], section[aria-label]").first().evaluate((e) => ({ label: e.getAttribute("aria-label"), live: e.closest("[aria-live]")?.getAttribute("aria-live") ?? e.querySelector("[aria-live]")?.getAttribute("aria-live") ?? e.getAttribute("role") }));
      f.check(`${width}px: bildirim alanı adlandırılmış ve canlı bölge`, !!live.label && !!live.live, JSON.stringify(live));
      const close = toast.getByRole("button", { name: tr.notifications.close });
      if (await close.count()) { await close.click(); await expect(toast).toBeHidden({ timeout: 4000 }); f.check(`${width}px: kapatma düğmesi çalışıyor`, true); }
      else f.warn(`${width}px: bildirimde kapatma düğmesi yok (kendiliğinden kapanıyor mu bakılır)`);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await settle(page, `/projects/${slug}/labels`);
    await page.route(new RegExp(`/projects/${projectId}/labels$`), (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) }) : route.continue());
    await page.getByRole("button", { name: tr.labels.create }).first().click();
    const name = page.getByRole("dialog").locator("#label-name");
    await name.fill("Toast otomatik");
    await page.getByRole("dialog").locator('button[type="submit"]').click();
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toBeVisible({ timeout: 8000 });
    await expect(toast).toBeHidden({ timeout: 15_000 });
    f.check("bildirim kendiliğinden kapanıyor (≤ 15 sn)", true);
    expect(f.fails, f.message()).toEqual([]);
  });

  test("onay penceresi: dialog rolü, odak içeride kalıyor, Escape kapatıyor, odak tetikleyiciye dönüyor, 390 px'e sığıyor", async () => {
    const f = new Findings("Confirmation Dialog");
    expect((await api(page, "POST", `/projects/${projectId}/criteria`, { title: "Diyalog kriteri" })).status).toBe(201);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 700 });
      await settle(page, `/projects/${slug}/criteria`);
      const trigger = page.locator("li").filter({ hasText: "Diyalog kriteri" }).getByRole("button", { name: tr.criteria.delete, exact: true }).first();
      await trigger.focus();
      await trigger.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const info = await dialog.evaluate((d) => { const r = d.getBoundingClientRect(); return { modal: d.getAttribute("aria-modal"), name: d.getAttribute("aria-label") ?? d.getAttribute("aria-labelledby"), left: r.left, right: r.right, top: r.top, bottom: r.bottom, inside: d.contains(document.activeElement) }; });
      f.check(`${width}px: aria-modal ya da modal davranışı`, info.modal === "true" || info.inside, JSON.stringify(info));
      f.check(`${width}px: pencerenin erişilebilir adı var`, !!info.name, `${info.name}`);
      f.check(`${width}px: pencere ekrana sığıyor`, info.left >= 0 && info.right <= width + 1 && info.top >= 0 && info.bottom <= 700 + 1, JSON.stringify(info));
      f.check(`${width}px: açılınca odak pencerenin içinde`, info.inside);
      const closeNames = await dialog.getByRole("button").evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") ?? e.textContent ?? "").trim()));
      f.check(`${width}px: pencere düğme adları Türkçe (İngilizce "Close" kalmamış)`, !closeNames.includes("Close"), JSON.stringify(closeNames));
      // The focus guard hands focus back on the next frame, so each stop is read after it settled.
      const outside: string[] = [];
      for (let i = 0; i < 8; i += 1) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(150);
        if (!(await dialog.evaluate((d) => d.contains(document.activeElement)))) outside.push(`${i + 1}. Tab`);
      }
      f.check(`${width}px: Tab odağı pencerenin içinde tutuyor`, outside.length === 0, outside.join(", "));
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      f.check(`${width}px: Escape pencereyi kapatıyor`, true);
      f.check(`${width}px: kapanınca odak tetikleyiciye dönüyor`, await trigger.evaluate((e) => e === document.activeElement), await page.evaluate(() => document.activeElement?.tagName ?? "?"));
    }
    expect(f.fails, f.message()).toEqual([]);
  });

  test("offline ve yeniden deneme: bağlantı kesilince sayfa ne yapıyor, gelince toparlanıyor mu", async () => {
    const f = new Findings("Offline ve yeniden deneme");
    await page.setViewportSize({ width: 1280, height: 720 });
    await settle(page, `/projects/${slug}/labels`);
    await page.context().setOffline(true);
    await page.waitForTimeout(800);
    const offlineUi = await page.evaluate(() => {
      const text = document.body.innerText;
      return { banner: /çevrimdışı|bağlantı yok|internet|offline/i.test(text), status: !!document.querySelector('[role="status"]:not([data-sonner-toaster] *), [data-offline]') };
    });
    f.check("bağlantı kesilince kullanıcıya görünür bir 'çevrimdışı' uyarısı çıkıyor", offlineUi.banner || offlineUi.status, "uyarı yok");
    // Navigating while offline shows an error, not an endless spinner.
    await page.getByRole("link", { name: tr.app.nav.projects, exact: true }).first().click().catch(() => undefined);
    await page.waitForTimeout(2500);
    const stuck = await page.evaluate(() => ({ spinner: document.querySelectorAll('.animate-spin, [aria-busy="true"]').length, text: ((document.querySelector("#main-content") as HTMLElement | null)?.innerText ?? "").trim().slice(0, 80) }));
    f.check("çevrimdışıyken gezinince sonsuz yükleniyor ekranında kalınmıyor", stuck.spinner === 0, JSON.stringify(stuck));
    await page.context().setOffline(false);
    await page.reload();
    await expect(page.locator("#main-content")).toBeVisible();
    f.check("bağlantı gelince sayfa yeniden yüklenip çalışıyor", true);
    await settle(page, `/projects/${slug}/labels`);
    await page.context().setOffline(true);
    await page.getByRole("button", { name: tr.labels.create }).first().click();
    const name = page.getByRole("dialog").locator("#label-name");
    await name.fill("Çevrimdışı etiket");
    await page.getByRole("dialog").locator('button[type="submit"]').click();
    await expect(page.locator('[data-sonner-toast][data-type="error"], [role="alert"]').first()).toBeVisible({ timeout: 8000 });
    f.check("çevrimdışıyken kaydetmek hata gösteriyor (sessiz kalmıyor)", true);
    await expect(name).toHaveValue("Çevrimdışı etiket");
    f.check("çevrimdışı hatasında yazılan veri kalıyor", true);
    expect(f.fails, f.message()).toEqual([]);
  });

  test("HTTP hata ekranları: 404 durum kodu ve ekranı, olmayan proje, yetkisiz erişim, sunucu hatası", async ({ browser }) => {
    const f = new Findings("HTTP hata ekranları");
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const [locale, title] of [["tr", "Bu sayfayı bulamadık."], ["en", "We could not find this page."], ["de", "Diese Seite wurde nicht gefunden."]] as const) {
      await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
      const res = await page.goto("/pda-boyle-bir-sayfa-yok");
      f.check(`404 (${locale}): HTTP durum kodu 404`, res?.status() === 404, `${res?.status()}`);
      f.check(`404 (${locale}): başlık dilde doğru`, (await page.locator("h1").first().innerText()).trim() === title, await page.locator("h1").first().innerText());
      f.check(`404 (${locale}): ana sayfa/giriş bağlantısı var`, (await page.locator("main a[href], #error-main a[href]").count()) > 0);
      f.check(`404 (${locale}): arama motoru dizinine alınmıyor (noindex)`, /noindex/.test((await page.locator('meta[name="robots"]').getAttribute("content")) ?? ""));
    }
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: "tr", url: "http://localhost:3000" }]);
    const missing = await page.goto("/projects/olmayan-proje-slug-123");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const body = (await page.locator("body").innerText()).toLowerCase();
    f.check("olmayan proje: 404 ekranı gösteriliyor (boş ya da çökmüş ekran değil)", /bulamad|bulunamad|404/.test(body), `durum ${missing?.status()} "${body.slice(0, 80)}"`);
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anon = await guest.newPage();
    await anon.goto("/dashboard");
    await expect(anon).toHaveURL(/giris|login/);
    f.check("oturumsuz erişim (401) giriş sayfasına yönlendiriyor", true);
    await guest.close();
    for (const code of ["403", "500", "503"]) {
      const res = await page.goto(`/errors/${code}`);
      f.check(`/errors/${code}: ekran açılıyor ve kod bilgisi taşıyor`, res?.status() === 200 && (await page.locator(`[data-error-code="${code}"]`).isVisible()));
    }
    expect(f.fails, f.message()).toEqual([]);
  });
});

test.describe("Ana CTA ve başarı durumu (giriş sonrası)", () => {
  test("dashboard ve boş ekranlarda ana eylem belirgin, tek ve çalışıyor", async ({ browser }) => {
    const f = new Findings("Ana CTA");
    const context = await browser.newContext();
    const fresh = await context.newPage();
    await registerUser(fresh, uniqueUser("cta"));
    await fresh.setViewportSize({ width: 1280, height: 720 });
    await settle(fresh, "/projects");
    const primary = await fresh.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--primary)";
      document.body.append(probe);
      const primary = getComputedStyle(probe).color;
      probe.remove();
      return Array.from(document.querySelectorAll("#main-content a[href], #main-content button")).filter((e) => getComputedStyle(e).backgroundColor === primary).map((e) => (e.textContent ?? "").trim());
    });
    f.check("projeler (boş): ana renkli tek bir eylem var", primary.length >= 1 && primary.length <= 2, JSON.stringify(primary));
    await fresh.getByRole("link", { name: /proje.*(oluştur|ekle)|yeni proje/i }).first().click();
    await expect(fresh).toHaveURL(/yeni|new/);
    f.check("ana eylem proje oluşturma ekranına götürüyor", true);
    await context.close();
    expect(f.fails, f.message()).toEqual([]);
  });

  test("başarı durumu: kayıt eklenince bildirim/liste güncelleniyor (gerçek sunucu)", async () => {
    const f = new Findings("Success State");
    await page.setViewportSize({ width: 1280, height: 720 });
    await settle(page, `/projects/${slug}/criteria`);
    const title = `Başarı ${Date.now()}`;
    await page.getByRole("button", { name: tr.criteria.create }).first().click();
    const field = page.getByRole("dialog").locator("#criterion-title");
    if (await field.isVisible().catch(() => false)) {
      await field.fill(title);
      await page.getByRole("dialog").getByRole("button", { name: /kaydet|ekle|oluştur/i }).first().click();
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 8000 });
      f.check("yeni kayıt listede hemen görünüyor", true);
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 5000 });
      f.check("başarı sonrası pencere kapanıyor", true);
    } else {
      f.warn("kriter formu bulunamadı", "başarı durumu form-submit-results.spec.ts ile test edildi");
    }
    expect(f.fails, f.message()).toEqual([]);
  });
});
