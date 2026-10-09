import { test, expect } from "@playwright/test";

for (const [locale, url, title, intro] of [
  ["tr", "/tr/hakkimizda", "Hakkımızda", "Doğuş Üniversitesi"],
  ["en", "/en/about", "About us", "Doğuş University"],
  ["de", "/de/ueber-uns", "Über uns", "Doğuş-Universität"],
] as const) {
  test(`about page shows the story and both developers: ${locale}`, async ({ page }) => {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page.locator("article > header p").nth(1)).toContainText(intro);
    await expect(page.locator("article section")).toHaveCount(4);
    const cards = page.locator("#team > ul > li");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("Alper Temiz");
    await expect(cards.nth(1)).toContainText("Hamza Taşbay");
    await expect(cards.nth(0)).toContainText("Full Stack Developer");
    await expect(cards.nth(1)).toContainText("Full Stack Developer");
    await expect(page.locator('#team a[href="https://github.com/alperrte"]')).toBeVisible();
    await expect(page.locator('#team a[href="https://github.com/HmzT270"]')).toBeVisible();
    await expect(page.locator('#team a[href="mailto:alpertemiz15@gmail.com"]')).toBeVisible();
    await expect(page.locator('#team a[href="mailto:tasbayh@gmail.com"]')).toBeVisible();
    await expect(page.locator('#team a[href="https://www.linkedin.com/in/alpertemizz/"]')).toBeVisible();
    await expect(page.locator('#team a[href="https://www.linkedin.com/in/hamza-ta%C5%9Fbay-3b7b94304/"]')).toBeVisible();
    for (const [index, name, cv] of [[0, "Alper Temiz", "/cv/alper-temiz-cv.pdf"], [1, "Hamza Taşbay", "/cv/hamza-tasbay-cv.pdf"]] as const) {
      const card = cards.nth(index);
      const link = card.locator('a[href="' + cv + '"]');
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("target", "_blank");
      expect((await page.request.get(cv)).headers()["content-type"]).toContain("application/pdf");
      const photo = card.getByRole("img", { name: new RegExp(name) });
      await expect(photo).toBeVisible();
      expect(await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
  });
}

test("developer cards center the photo, name and role", async ({ page }) => {
  await page.goto("/about");
  for (const card of await page.locator("#team > ul > li").all()) {
    const cardBox = (await card.boundingBox())!;
    const cardCenter = cardBox.x + cardBox.width / 2;
    for (const target of [card.getByRole("img"), card.locator("h3"), card.getByText("Full Stack Developer")]) {
      const box = (await target.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - cardCenter)).toBeLessThan(2);
    }
  }
});

for (const width of [320, 768, 1440]) {
  test(`about page fits ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript(value => localStorage.setItem("theme", value), theme);
      await page.goto("/about");
      await expect(page.locator("#team")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  });
}

test("about page is linked from the footer and listed in the sitemap", async ({ page, request }) => {
  await page.goto("/login");
  await page.locator("footer").getByRole("link", { name: "Hakkımızda" }).click();
  await expect(page).toHaveURL(/\/tr\/hakkimizda$/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/tr/hakkimizda", "/en/about", "/de/ueber-uns"]) expect(sitemap).toContain(path);
});

test("landing navbar links to the about page", async ({ page }) => {
  await page.goto("/tr");
  await page.locator("header nav").getByRole("link", { name: "Hakkımızda" }).click();
  await expect(page).toHaveURL(/\/tr\/hakkimizda$/);
  await expect(page.locator("h1")).toHaveText("Hakkımızda");
});

test("public pages keep the landing navbar and the logo returns to the landing page", async ({ page }) => {
  for (const path of ["/about", "/faq", "/license"]) {
    await page.goto(path);
    const nav = page.locator("header nav");
    await expect(nav.getByRole("link", { name: "Hakkımızda" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Giriş yap" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Kayıt ol" })).toBeVisible();
  }
  await page.goto("/about");
  await page.locator("header").getByRole("link", { name: "PDA · Project Delivery Assistant" }).click();
  await expect(page).toHaveURL(/\/tr$/);
  await expect(page.locator("#landing-heading")).toBeVisible();
  await page.goBack();
  await page.locator("header nav").getByRole("link", { name: "Kayıt ol" }).click();
  await expect(page).toHaveURL(/\/tr\/kayit$/);
});

test("about page has a contents list that jumps to each section and stays in view while scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  const contents = page.getByRole("navigation", { name: "Bu sayfada" });
  const links = contents.getByRole("link");
  await expect(links).toHaveText(["Yolculuğumuz", "PDA nedir?", "Hedefimiz", "Bize ulaşın"]);
  await links.nth(3).click();
  await expect(page).toHaveURL(/#team$/);
  await expect(page.locator("#team")).toBeInViewport();
  await expect(contents).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(contents).toBeInViewport();
});
