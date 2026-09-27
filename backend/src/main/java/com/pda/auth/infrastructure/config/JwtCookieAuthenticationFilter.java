package com.pda.auth.infrastructure.config;

import com.pda.auth.application.service.JwtTokens;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.util.List;
import java.util.Set;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

final class JwtCookieAuthenticationFilter extends OncePerRequestFilter {

    private static final Set<String> ALLOWED_WHILE_PASSWORD_CHANGE_PENDING = Set.of(
            "/api/v1/auth/me", "/api/v1/auth/password/change", "/api/v1/auth/logout",
            "/api/v1/auth/refresh", "/api/v1/auth/csrf");

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
                users.findActiveById(identity.userId()).ifPresent(user ->
                        SecurityContextHolder.getContext().setAuthentication(
                                new UsernamePasswordAuthenticationToken(user, null,
                                        List.of(new SimpleGrantedAuthority("ROLE_" + user.globalRole())))));
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
        chain.doFilter(request, response);
    }
}
