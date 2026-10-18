import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./i18n/config";
import { ADMIN_ENTRY_PATH, buildPath, matchPath, normalizeProjectSection } from "./i18n/routing";
import { buildCsp, createNonce } from "./lib/security/csp";

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
const PROTECTED_PATHS = ["/dashboard", "/projects", "/organizations", "/settings", "/account", "/calendar", "/invitations", "/change-password", "/tasks", "/admin"];

/**
 * Passes a page request on (optionally rewritten) with a fresh Content-Security-Policy. Next.js finds the nonce in the
 * request's own CSP header and stamps it on its scripts; the layout reads `x-nonce` for the scripts it writes itself.
 * Redirects carry no document, so they skip this.
 */
function withCsp(request: NextRequest, options: { rewriteTo?: URL; headers?: Headers } = {}) {
  const nonce = createNonce();
  const internal = matchPath(request.nextUrl.pathname)?.internalPath ?? "";
  const meeting = /^\/projects\/[^/]+\/meetings\/[^/]+\/room$/.test(internal) || /^\/meeting-guest(?:\/[^/]+)?$/.test(internal);
  const policy = buildCsp(nonce, { meeting });
  const requestHeaders = new Headers(options.headers ?? request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const init = { request: { headers: requestHeaders } };
  const response = options.rewriteTo ? NextResponse.rewrite(options.rewriteTo, init) : NextResponse.next(init);
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Permissions-Policy", meeting ? "camera=(self), microphone=(self), display-capture=(self), geolocation=()" : "camera=(), microphone=(), display-capture=(), geolocation=()");
  if (internal.startsWith("/meeting-guest")) {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The administrator sign-in is one unprefixed address with no locale rewrite and no session hint check: it must be
  // reachable while signed out, and an admin with an unverified session still has to see it. Passing it through is
  // deliberate (not just "no route matched"); the page sets noindex itself and the header repeats it.
  if (pathname.replace(/\/+$/, "") === ADMIN_ENTRY_PATH) {
    const response = withCsp(request);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const stored = request.cookies.get(LOCALE_COOKIE)?.value;
  const preferred: Locale = isLocale(stored) ? stored : defaultLocale;
  const page = matchPath(pathname, preferred);
  if (!page) return withCsp(request);
  // Old forms (unprefixed, other language, `?section=`) all have one canonical destination.
  const normalized = normalizeProjectSection(page.route, request.nextUrl.search);
  const canonicalPath = normalized.route === page.route ? page.canonicalPath : buildPath(normalized.route, page.params, page.locale);
  if (pathname !== canonicalPath || normalized.search !== request.nextUrl.search) {
    const target = request.nextUrl.clone();
    target.pathname = canonicalPath;
    target.search = normalized.search;
    const redirect = NextResponse.redirect(target, 308);
    // An unprefixed URL resolves through the NEXT_LOCALE cookie, so its target differs per visitor:
    // a cached 308 would pin one language to that URL. Prefixed URLs do not depend on the cookie.
    if (!isLocale(pathname.split("/")[1].toLowerCase())) redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  }

  const authenticated = request.cookies.has("PDA_SESSION");

  // Old/bookmarked/footer help links must also keep a signed-in visitor in the workspace.
  // This chooses a layout only: AppShell and the API still validate the session.
  if (authenticated && (page.internalPath === "/faq" || page.internalPath === "/contact")) {
    const target = request.nextUrl.clone();
    target.pathname = buildPath(page.internalPath === "/faq" ? "/account/faq" : "/account/contact", {}, page.locale);
    const response = NextResponse.redirect(target, 307);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

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
  const response = withCsp(request, { rewriteTo: destination, headers: requestHeaders });
  if (stored !== page.locale) response.cookies.set(LOCALE_COOKIE, page.locale, { path: "/", sameSite: "lax", maxAge: 31_536_000, secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") });
  return response;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|.*\\..*).*)"],
};
