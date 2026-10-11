// Real screen reader check with NVDA (Windows): drives NVDA with Guidepup, opens PDA pages in a visible Chromium window and records
// what NVDA actually says. It takes over the keyboard focus and speaks aloud for several minutes: do not use the machine while
// it runs.
//
// One-time setup (outside the repository, nothing is added to package.json):
//   mkdir nvda-check ; cd nvda-check ; npm init -y ; npm install @guidepup/guidepup @guidepup/setup
//   npx @guidepup/setup install nvda ; npx @guidepup/setup setup       (portable NVDA under %LOCALAPPDATA%\guidepup, no admin)
// Run (the site on http://localhost:3000, or SITE=https://... ; PLAYWRIGHT_PATH points to the repo's @playwright/test):
//   set PLAYWRIGHT_PATH=<repo>\frontend\node_modules\@playwright\test
//   node <repo>\ops\nvda-check.cjs
//
// It prints a JSON report and exits 1 when a control is announced without a name, a heading/landmark structure is missing, or a
// validation error is not spoken.
const { execFileSync } = require("node:child_process");
const { nvda } = require("@guidepup/guidepup");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "@playwright/test");

const SITE = (process.env.SITE || "http://localhost:3000").replace(/\/$/, "");
const REJECTED = JSON.stringify({ version: 1, necessary: true, analytics: false, updatedAt: "2026-10-09T00:00:00.000Z" });
const problems = [];
const report = {};

function activateWindow(titlePart) {
  // Brings the test browser to the foreground so NVDA reads it and not whatever was in front.
  try {
    execFileSync("powershell", ["-NoProfile", "-Command", `(New-Object -ComObject WScript.Shell).AppActivate('${titlePart}') | Out-Null`], { stdio: "ignore" });
  } catch { /* ignore */ }
}

async function walk(page, label, stops) {
  activateWindow("PDA");
  await page.waitForTimeout(800);
  await page.mouse.click(8, 300); // a neutral spot in the page so the first Tab starts at the top
  const spoken = [];
  for (let i = 0; i < stops; i += 1) {
    await nvda.press("Tab");
    spoken.push((await nvda.lastSpokenPhrase()).trim());
  }
  report[label] = spoken;
  // A control announced with only its role ("düğmesi", "button", "edit") has no accessible name.
  const nameless = spoken.filter((s) => /^(düğmesi|düğme|button|link|bağlantı|edit|düzenle|giriş|combo box)\b[ ,]*$/i.test(s));
  if (nameless.length) problems.push(`${label}: announced without a name: ${JSON.stringify(nameless)}`);
  if (spoken.some((s) => s === "")) problems.push(`${label}: a Tab stop was silent`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, args: ["--force-renderer-accessibility"] });
  const context = await browser.newContext({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });
  await context.addInitScript((c) => localStorage.setItem("pda:cookie-consent", c), REJECTED);
  const page = await context.newPage();
  try {
    await nvda.start();

    // 1. Structure: headings and landmarks of the login page, read in browse mode.
    await page.goto(`${SITE}/tr/giris`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    activateWindow("PDA");
    const headings = [];
    for (let i = 0; i < 3; i += 1) { await nvda.perform(nvda.keyboardCommands.moveToNextHeading); headings.push((await nvda.lastSpokenPhrase()).trim()); }
    report["login headings"] = headings;
    if (!headings.some((h) => /başlık|heading/i.test(h))) problems.push("login: no heading announced");

    // 2. Tab walk of the main public pages.
    await walk(page, "login (Tab walk)", 16);
    for (const [label, path] of [["register", "/tr/kayit"], ["contact", "/tr/iletisim"], ["home", "/tr/ana-sayfa"]]) {
      await page.goto(`${SITE}${path}`, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      await walk(page, `${label} (Tab walk)`, label === "home" ? 14 : 18);
    }

    // 3. A validation error must be spoken: submit the empty contact form.
    await page.goto(`${SITE}/tr/iletisim`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    activateWindow("PDA");
    await page.getByRole("button", { name: "Gönder" }).focus();
    await nvda.press("Enter");
    await page.waitForTimeout(1200);
    const log = (await nvda.spokenPhraseLog()).join(" | ");
    report["contact empty submit (speech log)"] = log.slice(-600);
    if (!/zorunlu/i.test(log)) problems.push("contact: the required-field error was not spoken after an empty submit");

    // 4. The cookie banner and its dialog for a first-time visitor.
    const fresh = await browser.newContext({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });
    const freshPage = await fresh.newPage();
    await freshPage.goto(`${SITE}/tr/giris`, { waitUntil: "load" });
    await freshPage.waitForTimeout(2000);
    activateWindow("PDA");
    await freshPage.getByRole("button", { name: "Tercihleri yönet" }).focus();
    await nvda.press("Enter");
    await freshPage.waitForTimeout(800);
    const dialogLog = (await nvda.spokenPhraseLog()).join(" | ");
    report["cookie dialog opened (speech log)"] = dialogLog.slice(-400);
    if (!/(iletişim kutusu|dialog|Çerez)/i.test(dialogLog)) problems.push("cookie: opening the preferences dialog was not announced");
    await fresh.close();

    // 5. Signed-in workspace (optional): STORAGE_STATE=<Playwright storageState json of a signed-in account>.
    if (process.env.STORAGE_STATE) {
      const app = await browser.newContext({ storageState: process.env.STORAGE_STATE, locale: "tr-TR", viewport: { width: 1280, height: 800 } });
      await app.addInitScript((c) => localStorage.setItem("pda:cookie-consent", c), REJECTED);
      const appPage = await app.newPage();
      await appPage.goto(`${SITE}/tr/genel-bakis`, { waitUntil: "load" });
      await appPage.waitForTimeout(2500);
      await walk(appPage, "dashboard (Tab walk)", 22);
      // Landmarks of the workspace: navigation, main.
      const marks = [];
      for (let i = 0; i < 4; i += 1) { await nvda.perform(nvda.keyboardCommands.moveToNextLandmark); marks.push((await nvda.lastSpokenPhrase()).trim()); }
      report["dashboard landmarks"] = marks;
      // The notification centre is a dialog: opening it must be announced and Escape must close it.
      activateWindow("PDA");
      await appPage.getByRole("button", { name: /Bildirimler/ }).first().focus();
      await nvda.press("Enter");
      await appPage.waitForTimeout(900);
      const dlg = (await nvda.spokenPhraseLog()).slice(-6).join(" | ");
      report["notification centre opened"] = dlg;
      if (!/(iletişim kutusu|Bildirimler)/i.test(dlg)) problems.push("workspace: opening the notification centre was not announced");
      await nvda.press("Escape");
      await appPage.waitForTimeout(500);
      // An empty project form: the error must be spoken.
      await appPage.goto(`${SITE}/tr/projeler/yeni`, { waitUntil: "load" });
      await appPage.waitForTimeout(2000);
      activateWindow("PDA");
      await appPage.getByRole("button", { name: /^Projeyi oluştur$/ }).focus();
      await nvda.press("Enter");
      await appPage.waitForTimeout(1200);
      const form = (await nvda.spokenPhraseLog()).slice(-5).join(" | ");
      report["empty project form (speech)"] = form;
      if (!/(zorunlu|gerekli|geçersiz|girin)/i.test(form)) problems.push("workspace: the empty project form error was not spoken");
      await app.close();
    }
  } catch (error) {
    problems.push(`script error: ${error.message}`);
  } finally {
    await nvda.stop().catch(() => undefined);
    await browser.close();
  }
  console.log(JSON.stringify({ report, problems }, null, 2));
  process.exit(problems.length ? 1 : 0);
})();
