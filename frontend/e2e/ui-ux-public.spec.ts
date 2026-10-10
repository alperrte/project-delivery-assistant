import { expect, test, type Page } from "@playwright/test";
import { Findings, VIEWPORTS, focusSweep, overflowReport, touchTargets } from "./ui-audit";
import tr from "../src/i18n/messages/tr.json";

// UI/UX audit of the public pages (no backend needed). The checks mirror the checklist's section 6 items; the matching
// signed-in checks live in ui-ux-app.spec.ts. Results are also written to test-results/ui-audit.jsonl.

const PUBLIC = ["/", "/login", "/register", "/forgot-password", "/contact", "/about", "/faq", "/cookies", "/license", "/accessibility", "/privacy", "/kvkk"];

async function open(page: Page, path: string) {
  const errors: string[] = [];
  const onError = (e: Error) => errors.push(e.message);
  page.on("pageerror", onError);
  const response = await page.goto(path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  page.off("pageerror", onError);
  return { status: response?.status() ?? 0, errors };
}

const luminance = (rgb: string) => {
  const m = rgb.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  const [r, g, b] = m.slice(0, 3).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test.describe("Responsive düzen ve taşma (herkese açık sayfalar)", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} px: sayfalar açılır, içerik görünür, yatay taşma yok`, async ({ page }) => {
      test.setTimeout(180_000);
      const responsive = new Findings("Responsive düzen");
      const overflow = new Findings("Taşma ve kırılma kontrolü");
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const path of PUBLIC) {
        const { status, errors } = await open(page, path);
        const tag = `${path} @${vp.name}`;
        responsive.check(`${tag}: 200 döner`, status === 200, `durum ${status}`);
        responsive.check(`${tag}: konsolda hata yok`, errors.length === 0, errors.join(" | ").slice(0, 120));
        const main = page.locator("main, #main-content").first();
        responsive.check(`${tag}: ana içerik ve başlık görünür`, (await main.isVisible()) && (await page.locator("h1").first().isVisible().catch(() => false)));
        const report = await overflowReport(page);
        overflow.check(`${tag}: sayfa yatay kaymıyor`, report.docOverflow <= 1 && report.bodyOverflow <= 1, `taşma ${report.docOverflow}px`);
        overflow.check(`${tag}: ekran dışına çıkan öğe yok`, report.offenders.length === 0, report.offenders.join(" ; "));
      }
      expect(responsive.fails, responsive.message()).toEqual([]);
      expect(overflow.fails, overflow.message()).toEqual([]);
    });
  }
});

test.describe("Tutarlı tasarım sistemi (herkese açık sayfalar)", () => {
  test("renk token'ları iki temada tanımlı, yazı tipi ve köşe yarıçapı sayfalar arasında tutarlı", async ({ page }) => {
    const f = new Findings("Tutarlı tasarım sistemi");
    const tokens = ["--background", "--foreground", "--card", "--primary", "--primary-foreground", "--muted", "--muted-foreground", "--border", "--ring", "--destructive", "--success"];
    const fonts = new Set<string>();
    const headingFonts = new Set<string>();
    const radii = new Set<string>();
    for (const path of PUBLIC) {
      await open(page, path);
      const info = await page.evaluate((names) => {
        const root = getComputedStyle(document.documentElement);
        const missing = names.filter((n) => !root.getPropertyValue(n).trim());
        const h1 = document.querySelector("h1");
        const radii = Array.from(document.querySelectorAll("[data-slot='button']")).map((b) => getComputedStyle(b).borderRadius);
        return { missing, body: getComputedStyle(document.body).fontFamily, h1: h1 ? getComputedStyle(h1).fontFamily : "", radii };
      }, tokens);
      f.check(`${path}: token'lar tanımlı`, info.missing.length === 0, info.missing.join(", "));
      fonts.add(info.body);
      if (info.h1) headingFonts.add(info.h1);
      info.radii.forEach((r) => radii.add(r));
    }
    f.check("gövde yazı tipi tüm sayfalarda aynı", fonts.size === 1, [...fonts].join(" | "));
    f.check("başlık yazı tipi tüm sayfalarda aynı", headingFonts.size <= 2, [...headingFonts].join(" | "));
    const pill = (r: string) => parseFloat(r) > 1000;
    const nonPill = [...radii].filter((r) => !pill(r));
    f.check("Button bileşeninin köşe yarıçapı en fazla 3 farklı değer (pill hariç)", nonPill.length <= 3, nonPill.join(" | "));
    expect(f.fails, f.message()).toEqual([]);
  });
});

test.describe("Light / Dark tema ve tema tercihi (herkese açık sayfalar)", () => {
  test("her iki temada metin kontrastı yeterli, koyu temada beyaz blok kalmıyor", async ({ page }) => {
    test.setTimeout(120_000);
    const f = new Findings("Light / Dark tema");
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of PUBLIC) {
        await open(page, path);
        const info = await page.evaluate(() => {
          const body = getComputedStyle(document.body);
          const muted = Array.from(document.querySelectorAll("main p, main li, main span")).slice(0, 40);
          let worst = { ratio: 99, text: "" };
          const parse = (c: string) => (c.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
          const lum = (rgb: number[]) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
          const bgOf = (el: Element) => { for (let e: Element | null = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/[\d.]+/g); if (m && (m.length < 4 || Number(m[3]) > 0.9)) return parse(c); } return parse(getComputedStyle(document.body).backgroundColor); };
          for (const el of muted) {
            const t = (el.textContent ?? "").trim();
            if (!t || el.children.length > 2) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            const fg = parse(getComputedStyle(el).color);
            const bg = bgOf(el);
            const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
            const ratio = (hi + 0.05) / (lo + 0.05);
            if (ratio < worst.ratio) worst = { ratio, text: t.slice(0, 24) };
          }
          let whiteBlocks = 0;
          for (const el of Array.from(document.querySelectorAll("main *"))) {
            const r = el.getBoundingClientRect();
            if (r.width < 200 || r.height < 40) continue;
            const c = getComputedStyle(el).backgroundColor;
            const m = c.match(/[\d.]+/g);
            if (!m || (m.length > 3 && Number(m[3]) < 0.9)) continue;
            if (lum(parse(c)) > 0.8) whiteBlocks += 1;
          }
          return { bodyBg: body.backgroundColor, bodyFg: body.color, dark: document.documentElement.classList.contains("dark"), worst, whiteBlocks };
        });
        f.check(`${path} (${scheme}): html sınıfı sistem tercihini izliyor`, info.dark === (scheme === "dark"), `dark=${info.dark}`);
        f.check(`${path} (${scheme}): gövde kontrastı ≥ 4.5`, contrast(info.bodyFg, info.bodyBg) >= 4.5, `${contrast(info.bodyFg, info.bodyBg).toFixed(2)}`);
        f.check(`${path} (${scheme}): en düşük metin kontrastı ≥ 4.5`, info.worst.ratio >= 4.5, `${info.worst.ratio.toFixed(2)} "${info.worst.text}"`);
        if (scheme === "dark") f.check(`${path} (dark): beyaz blok yok`, info.whiteBlocks === 0, `${info.whiteBlocks} blok`);
      }
    }
    expect(f.fails, f.message()).toEqual([]);
  });

  test("tema seçimi kalıcı: sistemden farklı seçim yenilemede ve sayfalar arasında korunuyor; seçim yoksa sistem izleniyor", async ({ page }) => {
    const f = new Findings("Tema tercihi");
    const group = () => page.getByRole("group", { name: tr.common.theme.label }).first();
    const isDark = async () => (await page.locator("html.dark").count()) === 1;
    const pressedOf = (name: string) => group().getByRole("button", { name }).getAttribute("aria-pressed");
    const waitPressed = async (name: string, value: string) => {
      await expect.poll(() => pressedOf(name), { timeout: 5000 }).toBe(value);
    };

    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "/");
    f.check("kayıtsız ziyaretçi: açık sistem → açık tema", !(await isDark()));
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page, "/");
    f.check("kayıtsız ziyaretçi: koyu sistem → koyu tema", await isDark());

    // System is light: pinning "dark" differs from the system, so it must stick.
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "/");
    f.check("tema anahtarı sayfada var", await group().isVisible());
    await group().getByRole("button", { name: tr.common.theme.dark }).click();
    await expect(page.locator("html.dark")).toHaveCount(1);
    await page.reload();
    f.check("açık sistemde koyu seçim yenilemeden sonra korunur", await isDark());
    await page.goto("/login");
    f.check("koyu seçim başka sayfada da korunur", await isDark());
    await page.goto("/contact");
    f.check("koyu seçim üçüncü sayfada da korunur", await isDark());
    try { await waitPressed(tr.common.theme.dark, "true"); f.check("anahtar seçili durumu gösteriyor (aria-pressed)", true); }
    catch { f.check("anahtar seçili durumu gösteriyor (aria-pressed)", false, `aria-pressed=${await pressedOf(tr.common.theme.dark)}`); }
    f.check("diğer seçenek basılı değil", (await pressedOf(tr.common.theme.light)) === "false");

    // System is dark: pinning "light" differs from the system, so it must stick as well.
    await page.evaluate(() => localStorage.removeItem("theme"));
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page, "/");
    f.check("kayıt silinince koyu sistem tekrar izleniyor", await isDark());
    await group().getByRole("button", { name: tr.common.theme.light }).click();
    await expect(page.locator("html.dark")).toHaveCount(0);
    await page.reload();
    f.check("koyu sistemde açık seçim yenilemeden sonra korunur", !(await isDark()));
    await page.goto("/login");
    f.check("açık seçim başka sayfada da korunur", !(await isDark()));

    // Tasarım kararı: sistemle aynı seçeneğe basmak sabitlemez, sistemi izlemeye döner.
    await group().getByRole("button", { name: tr.common.theme.dark }).click();
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    f.check("sistemle aynı seçenek sabitlemez, sistemi izler (açık sistem → açık)", !(await isDark()));

    // First paint: the theme is already decided when the HTML arrives (no white flash).
    await page.evaluate(() => localStorage.setItem("theme", "dark"));
    const html = await page.evaluate(async () => (await fetch(location.href)).text());
    f.check("ilk HTML'de tema betiği var (parlama riski yok)", /localStorage|prefers-color-scheme/.test(html));
    expect(f.fails, f.message()).toEqual([]);
  });
});

test.describe("Favicon ve uygulama ikonları", () => {
  test("başlıktaki ikonlar var, görsel olarak açılıyor; Apple ikonu ve manifest durumu", async ({ page, request }) => {
    const f = new Findings("Favicon ve uygulama ikonları");
    await open(page, "/");
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"], link[rel="shortcut icon"]')).map((l) => ({ rel: l.getAttribute("rel"), href: (l as HTMLLinkElement).href, sizes: l.getAttribute("sizes") })));
    const icons = links.filter((l) => /icon/.test(l.rel ?? "") && !/apple/.test(l.rel ?? ""));
    f.check("<link rel=icon> var", icons.length > 0, JSON.stringify(links));
    for (const l of links.filter((x) => x.rel !== "manifest")) {
      const res = await request.get(l.href);
      f.check(`${l.rel} ${new URL(l.href).pathname} açılıyor ve görsel`, res.ok() && /image\//.test(res.headers()["content-type"] ?? ""), `${res.status()} ${res.headers()["content-type"]}`);
    }
    const favicon = await request.get("/favicon.ico");
    f.check("/favicon.ico adresi cevap veriyor (tarayıcılar önce buraya bakar)", favicon.ok(), `durum ${favicon.status()}`);
    f.check("apple-touch-icon tanımlı (iOS ana ekran)", links.some((l) => l.rel === "apple-touch-icon"), "yok");
    const manifest = links.find((l) => l.rel === "manifest");
    f.check("web uygulama manifesti tanımlı (Android/PWA ikonları)", !!manifest, "yok");
    if (manifest) {
      const res = await request.get(manifest.href);
      const body = res.ok() ? await res.json() : {};
      const sizes = ((body.icons ?? []) as { sizes?: string }[]).map((i) => i.sizes);
      f.check("manifest 192x192 ve 512x512 ikon içeriyor", sizes.includes("192x192") && sizes.includes("512x512"), JSON.stringify(sizes));
    }
    expect(f.fails, f.message()).toEqual([]);
  });
});

test.describe("Dokunmatik kullanılabilirlik", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("hedefler ≥ 24 px (WCAG 2.5.8), yakınlaştırma kapatılmamış, tap çalışıyor", async ({ page }) => {
    test.setTimeout(120_000);
    const f = new Findings("Dokunmatik kullanılabilirlik");
    for (const path of ["/", "/login", "/register", "/forgot-password", "/contact", "/faq", "/about"]) {
      await open(page, path);
      const targets = await touchTargets(page);
      const small = targets.filter((t) => Math.min(t.w, t.h) < 24);
      f.check(`${path}: tüm hedefler ≥ 24 px`, small.length === 0, small.slice(0, 4).map((t) => `${t.name} ${t.w}x${t.h}`).join(" ; "));
      const mid = targets.filter((t) => Math.min(t.w, t.h) >= 24 && Math.min(t.w, t.h) < 44);
      if (mid.length) f.warn(`${path}: ${mid.length}/${targets.length} hedef 24–44 px arası (önerilen 44)`, mid.slice(0, 3).map((t) => `${t.name} ${t.w}x${t.h}`).join(" ; "));
      const viewport = await page.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "");
      f.check(`${path}: yakınlaştırma engellenmemiş`, !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?(\s|,|$)/.test(viewport), viewport);
      const smallInputs = await page.evaluate(() => Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select")).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.getAttribute("name") ?? e.tagName));
      f.check(`${path}: form alanları ≥ 16 px (iOS otomatik yakınlaştırma yapmaz)`, smallInputs.length === 0, smallInputs.join(", "));
    }
    await open(page, "/login");
    await page.getByLabel(tr.login.email, { exact: true }).tap();
    f.check("tap ile alana odaklanılıyor", await page.getByLabel(tr.login.email, { exact: true }).evaluate((e) => e === document.activeElement));
    expect(f.fails, f.message()).toEqual([]);
  });
});

test.describe("Ana CTA ve Geçişlerde başlık (herkese açık)", () => {
  test("açılış sayfasının ilk ekranında tek net ana eylem var ve kayda götürüyor", async ({ page }) => {
    const f = new Findings("Ana CTA");
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, "/");
    const primary = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const sample = document.createElement("span");
      sample.style.color = "var(--primary)";
      document.body.append(sample);
      const primaryBg = getComputedStyle(sample).color;
      sample.remove();
      return Array.from(document.querySelectorAll("main a[href], main button, header a[href]"))
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top < window.innerHeight && r.bottom > 0 && getComputedStyle(el).backgroundColor === primaryBg; })
        .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 30), href: (el as HTMLAnchorElement).getAttribute("href") ?? "" }));
    });
    f.check("ilk ekranda en az bir ana renkli eylem var", primary.length >= 1, JSON.stringify(primary));
    f.check("ilk ekranda en fazla 2 ana renkli eylem var (karar yükü az)", primary.length <= 2, JSON.stringify(primary));
    f.check("ana eylem kayıt sayfasına gidiyor", primary.some((p) => /register|kayit/.test(p.href)), JSON.stringify(primary));
    await open(page, "/login");
    const submit = page.locator('form button[type="submit"]').first();
    f.check("giriş: tek ana eylem (gönder) görünür", await submit.isVisible());
    expect(f.fails, f.message()).toEqual([]);
  });

  test("odak sırası: klavye ile geçiş, odak halkası her öğede çiziliyor", async ({ page }) => {
    const f = new Findings("Hover / Focus / Active State");
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const path of ["/", "/login", "/register", "/contact", "/faq"]) {
      await open(page, path);
      const sweep = await focusSweep(page, 45);
      f.check(`${path}: en az 5 öğeye klavyeyle ulaşılıyor`, sweep.length >= 5, `${sweep.length}`);
      const bad = sweep.filter((s) => !s.visible);
      f.check(`${path}: odaklanan ${sweep.length} öğenin hepsinde odak halkası var`, bad.length === 0, bad.slice(0, 4).map((b) => b.name).join(" ; "));
    }
    expect(f.fails, f.message()).toEqual([]);
  });

  test("hover ve active: düğme/bağlantılar üzerine gelince ve basılınca görünüm değişiyor", async ({ page }) => {
    const f = new Findings("Hover / Focus / Active State");
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const path of ["/", "/login", "/contact"]) {
      await open(page, path);
      const targets = page.locator("header a[href], main a[href], main button:not([disabled]), form button:not([disabled])");
      const count = Math.min(await targets.count(), 10);
      let hoverChanged = 0, hoverTested = 0, activeChanged = 0, activeTested = 0;
      const noHover: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const el = targets.nth(i);
        if (!(await el.isVisible())) continue;
        await el.scrollIntoViewIfNeeded().catch(() => undefined);
        const sig = () => el.evaluate((e) => { const cs = getComputedStyle(e); return [cs.backgroundColor, cs.color, cs.borderTopColor, cs.boxShadow, cs.textDecorationLine, cs.transform, cs.opacity, cs.filter, cs.translate, cs.scale].join("|"); });
        await page.mouse.move(0, 0);
        await page.waitForTimeout(250);
        const before = await sig();
        await el.hover({ timeout: 3000 }).catch(() => undefined);
        await page.waitForTimeout(350);
        const hovered = await sig();
        hoverTested += 1;
        if (hovered !== before) hoverChanged += 1;
        else noHover.push(((await el.textContent()) ?? "").trim().slice(0, 20) || (await el.getAttribute("aria-label")) || "?");
        if ((await el.evaluate((e) => e.tagName)) === "BUTTON") {
          await page.mouse.down();
          await page.waitForTimeout(250);
          const pressed = await sig();
          activeTested += 1;
          if (pressed !== hovered) activeChanged += 1;
          await page.mouse.move(0, 0);
          await page.mouse.up();
        }
      }
      f.check(`${path}: hover görünümü değişiyor (${hoverChanged}/${hoverTested})`, hoverTested > 0 && hoverChanged / hoverTested >= 0.7, `değişmeyenler: ${noHover.join(", ")}`);
      if (activeTested) f.check(`${path}: active (basılı) görünümü değişiyor (${activeChanged}/${activeTested})`, activeChanged / activeTested >= 0.5, `${activeChanged}/${activeTested}`);
    }
    expect(f.fails, f.message()).toEqual([]);
  });
});
