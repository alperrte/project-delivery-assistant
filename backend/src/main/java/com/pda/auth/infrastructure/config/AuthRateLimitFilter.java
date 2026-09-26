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

    private static final String REFRESH_PATH = "/api/v1/auth/refresh";
    private static final long WINDOW_MILLIS = Duration.ofMinutes(10).toMillis();
    private static final int MAX_REQUESTS = 5;
    private static final int MAX_REFRESH_REQUESTS = 30;
    private static final int MAX_IPS = 10_000;
    private final Map<String, ArrayDeque<Long>> attempts = new HashMap<>();
    private long requests;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !"/api/v1/auth/register".equals(path) && !"/api/v1/auth/login".equals(path)
                && !REFRESH_PATH.equals(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String key = request.getRequestURI() + ":" + request.getRemoteAddr();
        String path = request.getRequestURI().substring(request.getContextPath().length());
        int limit = REFRESH_PATH.equals(path) ? MAX_REFRESH_REQUESTS : MAX_REQUESTS;
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
