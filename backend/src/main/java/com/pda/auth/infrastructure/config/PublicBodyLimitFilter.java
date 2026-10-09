package com.pda.auth.infrastructure.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Caps the body of the anonymous public endpoints before anything reads it. Browsers always send a Content-Length for
 * these JSON requests, so a body that is larger, or whose size is not announced, is refused outright (413 / 411)
 * without being parsed. The limits are far above any legitimate request and bound what a hostile client can make the
 * server buffer.
 */
final class PublicBodyLimitFilter extends OncePerRequestFilter {

    static final int ANALYTICS_MAX_BYTES = 2_048;
    static final int CONTACT_MAX_BYTES = 16_384;

    private static final Map<String, Integer> LIMITS = Map.of(
            AuthRateLimitFilter.ANALYTICS_PATH, ANALYTICS_MAX_BYTES,
            AuthRateLimitFilter.CONTACT_PATH, CONTACT_MAX_BYTES);

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !LIMITS.containsKey(pathOf(request));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long length = request.getContentLengthLong();
        if (length < 0) {
            refuse(response, 411, "Length Required", "Content-Length is required", "LENGTH_REQUIRED");
            return;
        }
        if (length > LIMITS.get(pathOf(request))) {
            refuse(response, 413, "Payload Too Large", "Request body is too large", "PAYLOAD_TOO_LARGE");
            return;
        }
        chain.doFilter(request, response);
    }

    private static String pathOf(HttpServletRequest request) {
        return request.getRequestURI().substring(request.getContextPath().length());
    }

    private static void refuse(HttpServletResponse response, int status, String title, String detail, String code)
            throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"" + title + "\",\"status\":" + status
                + ",\"detail\":\"" + detail + "\",\"code\":\"" + code + "\"}");
    }
}
