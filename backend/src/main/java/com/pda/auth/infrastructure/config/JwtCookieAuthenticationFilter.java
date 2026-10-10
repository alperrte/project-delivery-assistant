package com.pda.auth.infrastructure.config;

import com.pda.auth.AuthenticatedSession;
import com.pda.auth.application.service.JwtTokens;
import com.pda.user.AdminReauthenticationRequiredException;
import com.pda.user.GlobalRole;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

final class JwtCookieAuthenticationFilter extends OncePerRequestFilter {

    /** Response header: milliseconds the access token that authenticated the request stays valid. Exposed by CORS. */
    static final String ACCESS_EXPIRES_IN_HEADER = "X-Access-Token-Expires-In";

    private static final String ADMIN_API = "/api/v1/admin";

    private static final Set<String> ALLOWED_WHILE_PASSWORD_CHANGE_PENDING = Set.of(
            "/api/v1/auth/me", "/api/v1/auth/password/change", "/api/v1/auth/logout",
            "/api/v1/auth/refresh", "/api/v1/auth/csrf",
            // Anonymous endpoints that ignore the session; a pending password change must not break them.
            "/api/v1/analytics/events", "/api/v1/contact");

    private final JwtTokens tokens;
    private final AuthCookies cookies;
    private final UserAccounts users;
    private final UserSessions sessions;
    private final Clock clock;

    JwtCookieAuthenticationFilter(JwtTokens tokens, AuthCookies cookies, UserAccounts users,
                                  UserSessions sessions, Clock clock) {
        this.tokens = tokens;
        this.cookies = cookies;
        this.users = users;
        this.sessions = sessions;
        this.clock = clock;
    }

    /**
     * An account flagged for a forced password change (the bootstrapped administrator) may only read its own
     * identity, change the password, refresh or log out until the change is done.
     */
    private static boolean passwordChangeRequired(HttpServletRequest request) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !(authentication.getPrincipal() instanceof UserAccounts.AuthenticatedUser user)
                || !user.mustChangePassword()) {
            return false;
        }
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !ALLOWED_WHILE_PASSWORD_CHANGE_PENDING.contains(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        tokens.parseAccess(cookies.access(request)).ifPresent(identity -> {
            if (sessions.isActive(identity.sessionId(), identity.userId(), clock.instant())) {
                users.findActiveById(identity.userId()).ifPresent(found -> {
                    // Only an administrator account can carry the mark, and only when its session was opened by the
                    // administrator sign-in; the role itself is never taken from the token.
                    UserAccounts.AuthenticatedUser user = GlobalRole.ADMIN.name().equals(found.globalRole())
                            ? found.withAdminVerified(sessions.isAdminVerified(
                                    identity.sessionId(), identity.userId(), clock.instant()))
                            : found;
                    SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(user, null,
                                    List.of(new SimpleGrantedAuthority("ROLE_" + user.globalRole()))));
                    // For connections that outlive this request (the chat WebSocket): which session this was.
                    request.setAttribute(AuthenticatedSession.REQUEST_ATTRIBUTE,
                            new AuthenticatedSession(user.id(), identity.sessionId(), identity.expiresAt()));
                    // How long the access token stays valid, in milliseconds from now (nothing secret in it; a
                    // duration rather than a point in time, so a browser clock that is off cannot mislead it). The
                    // browser client renews the session, and the chat socket with it, shortly before it runs out.
                    long remaining = Duration.between(clock.instant(), identity.expiresAt()).toMillis();
                    response.setHeader(ACCESS_EXPIRES_IN_HEADER, String.valueOf(Math.max(remaining, 0)));
                });
            }
        });
        if (passwordChangeRequired(request)) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/problem+json");
            response.setHeader("Cache-Control", "no-store");
            response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Forbidden\",\"status\":403,"
                    + "\"detail\":\"Password change required\",\"code\":\"password_change_required\"}");
            return;
        }
        if (adminSessionNotVerified(request)) {
            SecurityContextHolder.clearContext();
            writeAdminReauthenticationRequired(response);
            return;
        }
        chain.doFilter(request, response);
    }

    /**
     * The administrator API needs an administrator account AND a session opened by the administrator sign-in. An
     * administrator whose session came from anywhere else (an older session) is told to sign in again; a non-administrator
     * and an anonymous caller keep their ordinary 403 / 401 from the authorization rules.
     */
    private static boolean adminSessionNotVerified(HttpServletRequest request) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserAccounts.AuthenticatedUser user)
                || !GlobalRole.ADMIN.name().equals(user.globalRole()) || user.adminVerified()) {
            return false;
        }
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return path.equals(ADMIN_API) || path.startsWith(ADMIN_API + "/");
    }

    static void writeAdminReauthenticationRequired(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/problem+json");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Forbidden\",\"status\":403,"
                + "\"detail\":\"Administrator sign-in required\",\"code\":\""
                + AdminReauthenticationRequiredException.CODE + "\"}");
    }
}
