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
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

final class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final String PASSWORD_CHANGE_PATH = "/api/v1/auth/password/change";
    private static final String PASSWORD_CHANGE_CODE_PATH = "/api/v1/auth/password/change/code";
    private static final String PASSWORD_CHANGE_VERIFY_PATH = "/api/v1/auth/password/change/verify";
    private static final String PASSWORD_FORGOT_PATH = "/api/v1/auth/password/forgot";
    private static final String PASSWORD_RESET_PATH = "/api/v1/auth/password/reset";
    private static final String PASSWORD_RESET_VERIFY_PATH = "/api/v1/auth/password/reset/verify";
    private static final String REGISTER_VERIFY_PATH = "/api/v1/auth/register/verify";
    private static final String REGISTER_RESEND_PATH = "/api/v1/auth/register/resend";
    private static final String REFRESH_PATH = "/api/v1/auth/refresh";
    private static final String LOGIN_PATH = "/api/v1/auth/login";
    // The second sign-in step shares the login bucket; the real guess limit is the per-account lock on the credential.
    private static final String LOGIN_SECOND_FACTOR_PATH = "/api/v1/auth/login/2fa";
    private static final String TWO_FACTOR_ENABLE_PATH = "/api/v1/auth/2fa/enable";
    private static final String TWO_FACTOR_DISABLE_PATH = "/api/v1/auth/2fa/disable";
    private static final String TWO_FACTOR_RECOVERY_PATH = "/api/v1/auth/2fa/recovery-codes";
    // Administrator sign-in: password step, authenticator step and the two enrolment steps. All of them use the strict
    // sensitive bucket (5 per 10 minutes per address); the per-account authenticator lock (5 wrong codes, 15 minutes) applies too.
    private static final java.util.Set<String> ADMIN_AUTH_PATHS = java.util.Set.of("/api/v1/auth/admin/login",
            "/api/v1/auth/admin/login/2fa", "/api/v1/auth/admin/2fa/setup", "/api/v1/auth/admin/2fa/enable");
    private static final String ACCOUNT_DELETION_REQUEST_PATH = "/api/v1/auth/account/deletion/request";
    private static final String ACCOUNT_DELETION_CONFIRM_PATH = "/api/v1/auth/account/deletion/confirm";
    static final String ANALYTICS_PATH = "/api/v1/analytics/events";
    static final String CONTACT_PATH = "/api/v1/contact";
    private static final long WINDOW_MILLIS = Duration.ofMinutes(10).toMillis();
    // Production defaults. They can be raised for automated test environments only (see configured(...)).
    static final int DEFAULT_SENSITIVE_REQUESTS = 5;
    static final int DEFAULT_REFRESH_REQUESTS = 30;
    // Every login request counts, successful ones too, so 5 locked out ordinary users.
    static final int DEFAULT_LOGIN_REQUESTS = 30;
    // Anonymous visit events (one page view per navigation, one heartbeat about every 15 seconds per open tab).
    static final int DEFAULT_ANALYTICS_REQUESTS = 600;
    // The public contact form relays mail, so it gets the strictest limit.
    static final int DEFAULT_CONTACT_REQUESTS = 5;
    private static final int MAX_IPS = 10_000;

    private final int maxRequests;
    private final int maxRefreshRequests;
    private final int maxLoginRequests;
    private final int maxAnalyticsRequests;
    private final int maxContactRequests;
    private final Map<String, ArrayDeque<Long>> attempts = new HashMap<>();
    private long requests;

    AuthRateLimitFilter() {
        this(DEFAULT_SENSITIVE_REQUESTS, DEFAULT_LOGIN_REQUESTS, DEFAULT_REFRESH_REQUESTS);
    }

    AuthRateLimitFilter(int maxRequests, int maxLoginRequests, int maxRefreshRequests) {
        this(maxRequests, maxLoginRequests, maxRefreshRequests, DEFAULT_ANALYTICS_REQUESTS, DEFAULT_CONTACT_REQUESTS);
    }

    AuthRateLimitFilter(int maxRequests, int maxLoginRequests, int maxRefreshRequests, int maxAnalyticsRequests,
                        int maxContactRequests) {
        if (maxRequests < 1 || maxLoginRequests < 1 || maxRefreshRequests < 1 || maxAnalyticsRequests < 1
                || maxContactRequests < 1) {
            throw new IllegalStateException("Rate limits must be at least 1");
        }
        this.maxRequests = maxRequests;
        this.maxLoginRequests = maxLoginRequests;
        this.maxRefreshRequests = maxRefreshRequests;
        this.maxAnalyticsRequests = maxAnalyticsRequests;
        this.maxContactRequests = maxContactRequests;
    }

    /**
     * The limits come from {@code auth.rate-limit.sensitive-max-requests} (register, register by invitation, external
     * invitation preview, register verify/resend, password change/forgot/reset), {@code auth.rate-limit.login-max-requests} and
     * {@code auth.rate-limit.refresh-max-requests} (refresh and OAuth). Without them the production defaults apply;
     * a raised value is meant for automated tests that sign many throw-away users up from one address, and is
     * announced in the log so it cannot go unnoticed. The public anonymous endpoints have their own limits:
     * {@code analytics.rate-limit.max-requests} (visit events) and {@code contact.rate-limit.max-requests} (contact form).
     */
    static AuthRateLimitFilter configured(Environment environment) {
        int sensitive = environment.getProperty("auth.rate-limit.sensitive-max-requests", Integer.class, DEFAULT_SENSITIVE_REQUESTS);
        int login = environment.getProperty("auth.rate-limit.login-max-requests", Integer.class, DEFAULT_LOGIN_REQUESTS);
        int refresh = environment.getProperty("auth.rate-limit.refresh-max-requests", Integer.class, DEFAULT_REFRESH_REQUESTS);
        int analytics = environment.getProperty("analytics.rate-limit.max-requests", Integer.class, DEFAULT_ANALYTICS_REQUESTS);
        int contact = environment.getProperty("contact.rate-limit.max-requests", Integer.class, DEFAULT_CONTACT_REQUESTS);
        AuthRateLimitFilter filter = new AuthRateLimitFilter(sensitive, login, refresh, analytics, contact);
        if (sensitive != DEFAULT_SENSITIVE_REQUESTS || login != DEFAULT_LOGIN_REQUESTS || refresh != DEFAULT_REFRESH_REQUESTS
                || analytics != DEFAULT_ANALYTICS_REQUESTS || contact != DEFAULT_CONTACT_REQUESTS) {
            LoggerFactory.getLogger(AuthRateLimitFilter.class).warn(
                    "Rate limits differ from the production defaults (sensitive={}, login={}, refresh={}, analytics={}, contact={}): for test environments only",
                    sensitive, login, refresh, analytics, contact);
        }
        return filter;
    }

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
                && !PASSWORD_CHANGE_CODE_PATH.equals(path) && !PASSWORD_CHANGE_VERIFY_PATH.equals(path)
                && !PASSWORD_FORGOT_PATH.equals(path) && !PASSWORD_RESET_PATH.equals(path)
                && !PASSWORD_RESET_VERIFY_PATH.equals(path)
                && !REGISTER_VERIFY_PATH.equals(path) && !REGISTER_RESEND_PATH.equals(path)
                && !LOGIN_SECOND_FACTOR_PATH.equals(path) && !TWO_FACTOR_ENABLE_PATH.equals(path)
                && !TWO_FACTOR_DISABLE_PATH.equals(path) && !TWO_FACTOR_RECOVERY_PATH.equals(path)
                && !ACCOUNT_DELETION_REQUEST_PATH.equals(path) && !ACCOUNT_DELETION_CONFIRM_PATH.equals(path)
                && !ADMIN_AUTH_PATHS.contains(path)
                && !ANALYTICS_PATH.equals(path) && !CONTACT_PATH.equals(path);
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
        int limit = REFRESH_PATH.equals(path) || isOAuthRedirect(path) ? maxRefreshRequests
                : LOGIN_PATH.equals(path) || LOGIN_SECOND_FACTOR_PATH.equals(path) ? maxLoginRequests
                : ANALYTICS_PATH.equals(path) ? maxAnalyticsRequests
                : CONTACT_PATH.equals(path) ? maxContactRequests : maxRequests;
        if (!allow(key, limit, System.currentTimeMillis())) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Retry-After", "600");
            response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Too Many Requests\",\"status\":429,"
                    + "\"detail\":\"" + (ANALYTICS_PATH.equals(path) || CONTACT_PATH.equals(path)
                    ? "Rate limit exceeded" : "Authentication rate limit exceeded") + "\",\"code\":\"RATE_LIMITED\"}");
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
