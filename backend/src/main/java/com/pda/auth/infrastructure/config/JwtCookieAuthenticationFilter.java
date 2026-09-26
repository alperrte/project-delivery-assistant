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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

final class JwtCookieAuthenticationFilter extends OncePerRequestFilter {

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
        chain.doFilter(request, response);
    }
}
