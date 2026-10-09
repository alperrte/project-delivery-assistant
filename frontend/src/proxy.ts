import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./i18n/config";
import { buildPath, matchPath, normalizeProjectSection } from "./i18n/routing";

/**
 * Edge-level defense-in-depth for route access. This never replaces backend
 * authorization — every API call is still independently checked against the
 * real, HttpOnly `PDA_ACCESS`/`PDA_REFRESH` cookies server-side, and this
 * proxy cannot verify a JWT's signature or expiry without the signing
 * secret. Those two cookies are also deliberately scoped to `Path=/api*`
 * (backend/src/.../AuthCookies.java) so they are never sent on a plain page
 * request in the first place; `PDA_SESSION` is a separate, non-authoritative
 * `Path=/` marker set alongside them purely so this proxy has something
 * to check. It carries no token and grants nothing by itself — it only
 * avoids shipping a protected page shell to a browser that plainly has no
 * session, and skips the flash of a loading skeleton before the client-side
 * check (`useSession` in `AppShell`) would otherwise redirect anyway.
 *
 * Deliberately one-directional: it only turns away a session-less browser
 * from a protected path. It does not bounce an authenticated browser away
 * from `/login` etc., since the session hint alone can't tell whether that
 * session still has `mustChangePassword` pending (only the real `/auth/me`
 * response can) — that redirect stays owned by `AppShell`/the login form.
 */
const PROTECTED_PATHS = ["/dashboard", "/projects", "/organizations", "/settings", "/account", "/calendar", "/invitations", "/change-password", "/tasks"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const stored = request.cookies.get(LOCALE_COOKIE)?.value;
  const preferred: Locale = isLocale(stored) ? stored : defaultLocale;
  const page = matchPath(pathname, preferred);
  if (!page) return NextResponse.next();
  // Old forms (unprefixed, other language, `?section=`) all have one canonical destination.
  const normalized = normalizeProjectSection(page.route, request.nextUrl.search);
  const canonicalPath = normalized.route === page.route ? page.canonicalPath : buildPath(normalized.route, page.params, page.locale);
  if (pathname !== canonicalPath || normalized.search !== request.nextUrl.search) {
    const target = request.nextUrl.clone();
    target.pathname = canonicalPath;
    target.search = normalized.search;
    return NextResponse.redirect(target, 308);
  }

  const authenticated = request.cookies.has("PDA_SESSION");

  if (!authenticated && PROTECTED_PATHS.some(path => page.internalPath === path || page.internalPath.startsWith(`${path}/`))) {
    const loginUrl = new URL(buildPath("/login", {}, page.locale), request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const destination = request.nextUrl.clone();
  destination.pathname = page.internalPath;
  if (page.section) destination.searchParams.set("section", page.section);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pda-locale", page.locale);
  const response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  if (stored !== page.locale) response.cookies.set(LOCALE_COOKIE, page.locale, { path: "/", sameSite: "lax", maxAge: 31_536_000 });
  return response;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|.*\\..*).*)"],
};
