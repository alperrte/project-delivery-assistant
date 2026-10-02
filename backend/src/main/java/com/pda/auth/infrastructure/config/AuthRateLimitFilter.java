package com.pda.auth.infrastructure.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

final class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final String PASSWORD_CHANGE_PATH = "/api/v1/auth/password/change";
    private static final String PASSWORD_FORGOT_PATH = "/api/v1/auth/password/forgot";
    private static final String PASSWORD_RESET_PATH = "/api/v1/auth/password/reset";
    private static final String REFRESH_PATH = "/api/v1/auth/refresh";
    private static final String LOGIN_PATH = "/api/v1/auth/login";
    private static final long WINDOW_MILLIS = Duration.ofMinutes(10).toMillis();
    private static final int MAX_REQUESTS = 5;
    private static final int MAX_REFRESH_REQUESTS = 30;
    // Every login request counts, successful ones too, so 5 locked out ordinary users.
    private static final int MAX_LOGIN_REQUESTS = 30;
    private static final int MAX_IPS = 10_000;
    private final Map<String, ArrayDeque<Long>> attempts = new HashMap<>();
    private long requests;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if ("GET".equals(request.getMethod())) {
            return !isOAuthRedirect(path);
        }
        if (!"POST".equals(request.getMethod())) {
            return true;
        }
        return !"/api/v1/auth/register".equals(path) && !"/api/v1/auth/register/invitation".equals(path)
                && !"/api/v1/project-invitations/external/preview".equals(path) && !LOGIN_PATH.equals(path)
                && !REFRESH_PATH.equals(path) && !PASSWORD_CHANGE_PATH.equals(path)
                && !PASSWORD_FORGOT_PATH.equals(path) && !PASSWORD_RESET_PATH.equals(path);
    }

    private static String routeOf(String path) {
        if (path.startsWith("/api/v1/auth/oauth2/authorization/")) return "/api/v1/auth/oauth2/authorization";
        if (path.startsWith("/api/v1/auth/oauth2/callback/")) return "/api/v1/auth/oauth2/callback";
        return path;
    }

    private static boolean isOAuthRedirect(String path) {
        return path.startsWith("/api/v1/auth/oauth2/authorization/") || path.startsWith("/api/v1/auth/oauth2/callback/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        // The key is the route, never the raw URI: the OAuth paths end in a client-chosen segment, and a key per URI
        // would let one unauthenticated client fill the table and lock everybody else out.
        String key = routeOf(path) + ":" + request.getRemoteAddr();
        int limit = REFRESH_PATH.equals(path) || isOAuthRedirect(path) ? MAX_REFRESH_REQUESTS
                : LOGIN_PATH.equals(path) ? MAX_LOGIN_REQUESTS : MAX_REQUESTS;
        if (!allow(key, limit, System.currentTimeMillis())) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Retry-After", "600");
            response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Too Many Requests\",\"status\":429,"
                    + "\"detail\":\"Authentication rate limit exceeded\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private synchronized boolean allow(String remoteAddress, int limit, long now) {
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
        if (times.size() >= limit) {
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
