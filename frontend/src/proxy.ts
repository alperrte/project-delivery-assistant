import { NextResponse, type NextRequest } from "next/server";

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
const PROTECTED_PATHS = ["/dashboard", "/projects", "/organizations", "/account", "/calendar", "/invitations", "/change-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = request.cookies.has("PDA_SESSION");

  if (!authenticated && PROTECTED_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/organizations/:path*",
    "/account/:path*",
    "/calendar/:path*",
    "/invitations/:path*",
    "/change-password",
  ],
};
