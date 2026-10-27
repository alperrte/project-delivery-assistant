import { test, expect } from "@playwright/test";
import { localizeHref } from "../src/i18n/routing";

// HTTP page-shell checks never call an API. Browser session responses below are
// intercepted; no real account, DB setup or backend request is involved.
for (const locale of ["tr", "en", "de"] as const) {
  const project = "00000000-0000-0000-0000-000000000099";
  const member = { Cookie: `PDA_SESSION=1; NEXT_LOCALE=${locale}` };

  test(`${locale}: direct meeting create URLs render locally without redirecting to themselves`, async ({ request, baseURL }) => {
    for (const query of ["type=independent", "type=project", `type=project&project=${project}`]) {
      const href = localizeHref(`/meetings/new?${query}`, locale);
      const response = await request.get(href, { headers: member, maxRedirects: 0 });
      expect(response.status(), href).toBe(200);
      expect(response.headers().location).toBeUndefined();
      const rewrite = new URL(response.headers()["x-middleware-rewrite"], baseURL);
      expect(rewrite.origin).toBe(new URL(baseURL!).origin);
      expect(rewrite.pathname).toBe("/meetings/new");
      expect(rewrite.search).toBe(`?${query}`);
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}"`);
      expect(response.headers()["permissions-policy"]).toContain("camera=()");
      const nonce = /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"])?.[1];
      expect(nonce).toBeTruthy();
      expect(html).toContain(`nonce="${nonce}"`);
    }
  });

  test(`${locale}: anonymous create URLs go to login once and retain their destination`, async ({ request, baseURL }) => {
    for (const query of ["type=independent", `type=project&project=${project}`]) {
      const href = localizeHref(`/meetings/new?${query}`, locale);
      const response = await request.get(href, { headers: { Cookie: `NEXT_LOCALE=${locale}` }, maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const login = new URL(response.headers().location, baseURL);
      expect(login.pathname).toBe(localizeHref("/login", locale));
      expect(login.searchParams.get("next")).toBe(href);
      const destination = await request.get(login.href, { maxRedirects: 0 });
      expect(destination.status()).toBe(200);
      expect(await destination.text()).toContain(`<html lang="${locale}"`);
    }
  });

  test(`${locale}: old and mixed-language create bookmarks canonicalize once with their query`, async ({ request, baseURL }) => {
    const query = `type=project&project=${project}`;
    for (const alias of ["/meetings/new", `/${locale}/MEETINGS/NEW`]) {
      const expected = localizeHref(`/meetings/new?${query}`, locale);
      const response = await request.get(`${alias}?${query}`, { headers: member, maxRedirects: 0 });
      expect(response.status()).toBe(308);
      const target = new URL(response.headers().location, baseURL);
      expect(target.pathname + target.search).toBe(expected);
      expect((await request.get(target.href, { headers: member, maxRedirects: 0 })).status()).toBe(200);
    }
  });

  test(`${locale}: project-scoped meeting bookmarks keep their existing global destinations`, async ({ request, baseURL }) => {
    const id = "00000000-0000-0000-0000-000000000088";
    for (const [legacy, target] of [
      ["/projects/old/meetings", "/meetings"],
      ["/projects/old/meetings/new", "/meetings/new"],
      [`/projects/old/meetings/${id}`, `/meetings/${id}`],
      [`/projects/old/meetings/${id}/edit`, `/meetings/${id}/edit`],
      [`/projects/old/meetings/${id}/room`, `/meetings/${id}/room`],
      ["/projects/old/meetings/calendar", "/calendar?project=old"],
    ]) {
      const response = await request.get(localizeHref(legacy, locale), { headers: member, maxRedirects: 0 });
      // App Router redirect() uses 307 before streaming, or a redirect in the
      // streamed document/Flight payload. Always assert the exact target.
      let location: string | undefined = response.headers().location;
      if (response.status() === 200) {
        const html = await response.text();
        const refresh = html.match(/<meta\b[^>]*http-equiv="refresh"[^>]*>/)?.[0];
        location = refresh?.match(/content="[01];url=([^"]+)"/)?.[1].replaceAll("&amp;", "&")
          ?? html.match(/NEXT_REDIRECT;(?:replace|push);([^;]+);307;/)?.[1];
      } else expect(response.status(), legacy).toBe(307);
      expect(location).toBeTruthy();
      const destination = new URL(location!, baseURL);
      expect(destination.pathname + destination.search).toBe(localizeHref(target, locale));
      expect((await request.get(destination.href, { headers: member, maxRedirects: 0 })).status()).toBe(200);
    }
  });

  test(`${locale}: a stale session hint still requires a valid API session`, async ({ page, context, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    await context.addCookies([{ name: "PDA_SESSION", value: "1", url: origin }, { name: "NEXT_LOCALE", value: locale, url: origin }]);
    await page.route("**/api/v1/**", route => route.fulfill({
      status: new URL(route.request().url()).pathname.endsWith("/auth/csrf") ? 200 : 401,
      headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" },
      contentType: "application/json", body: JSON.stringify({ headerName: "X-XSRF-TOKEN" }),
    }));
    await page.goto(localizeHref("/meetings/new?type=independent", locale));
    await expect(page).toHaveURL(new RegExp(`${localizeHref("/login", locale)}(?:[?].*)?$`));
    await expect(page.locator("#meeting-title")).toHaveCount(0);
  });
}
