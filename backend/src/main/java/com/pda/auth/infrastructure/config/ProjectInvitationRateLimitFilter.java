package com.pda.auth.infrastructure.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Rate-limits project invitation create/resend/accept/reject (HMZ-PROJ-48), mirroring
 * {@link AuthRateLimitFilter}'s sliding-window, per-IP-per-path pattern. Lives beside it in the shared security
 * config rather than in the project module: this class' whole job is knowing HTTP path strings for the security
 * filter chain, the same thing SecurityBaselineConfiguration already does for every module by path string only,
 * never by importing that module's types.
 */
final class ProjectInvitationRateLimitFilter extends OncePerRequestFilter {

    private static final Pattern CREATE = Pattern.compile("^/api/v1/projects/[^/]+/invitations$");
    private static final Pattern RESEND_ACCEPT_REJECT =
            Pattern.compile("^/api/v1/projects/[^/]+/invitations/[^/]+/(resend|accept|reject)$");
    private static final long WINDOW_MILLIS = Duration.ofMinutes(10).toMillis();
    // Higher than the pre-auth login/register limit (5): these are authenticated, legitimate-manager actions
    // (inviting several teammates in one session) rather than an attacker-facing credential-guessing surface.
    private static final int MAX_REQUESTS = 10;
    private static final int MAX_IPS = 10_000;

    private final Map<String, ArrayDeque<Long>> attempts = new HashMap<>();
    private long requests;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !CREATE.matcher(path).matches() && !RESEND_ACCEPT_REJECT.matcher(path).matches();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String key = request.getRequestURI() + ":" + request.getRemoteAddr();
        if (!allow(key, System.currentTimeMillis())) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Retry-After", "600");
            response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Too Many Requests\",\"status\":429,"
                    + "\"detail\":\"Invitation rate limit exceeded\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private synchronized boolean allow(String remoteAddress, long now) {
        if (++requests % 128 == 0 || attempts.size() >= MAX_IPS) {
            attempts.values().removeIf(times -> {
                trim(times, now);
                return times.isEmpty();
            });
        }
        ArrayDeque<Long> times = attempts.get(remoteAddress);
        if (times == null) {
            if (attempts.size() >= MAX_IPS) {
                return false;
            }
            times = new ArrayDeque<>();
            attempts.put(remoteAddress, times);
        } else {
            trim(times, now);
        }
        if (times.size() >= MAX_REQUESTS) {
            return false;
        }
        times.addLast(now);
        return true;
    }

    private static void trim(ArrayDeque<Long> times, long now) {
        while (!times.isEmpty() && times.peekFirst() <= now - WINDOW_MILLIS) {
            times.removeFirst();
        }
    }
}
