package com.pda.auth.infrastructure.config;

import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.application.service.LocalLoginService.LoginTokens;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthCookies {

    public static final String ACCESS = "PDA_ACCESS";
    public static final String REFRESH = "PDA_REFRESH";
    /**
     * Non-authoritative marker, {@code Path=/} so the frontend's edge middleware can see it (unlike {@link
     * #ACCESS}/{@link #REFRESH}, deliberately scoped to {@code /api*} to keep the real tokens off every other
     * request). It carries no token and grants nothing by itself — every API call is still independently
     * authorized against the {@code HttpOnly} {@link #ACCESS}/{@link #REFRESH} cookies — it only lets middleware
     * skip rendering a protected page shell for a browser that plainly has no session, mirroring the refresh
     * token's lifetime since that is how long a session can still be silently renewed.
     */
    public static final String SESSION_HINT = "PDA_SESSION";
    /** Ticket handed out after the forgot-password code was accepted; only valid for setting the new password. */
    public static final String RESET_TICKET = "PDA_RESET";
    public static final String RESET_TICKET_PATH = "/api/v1/auth/password";
    /** Ticket handed out after the account-settings password-change code was accepted. */
    public static final String CHANGE_TICKET = "PDA_PWCHANGE";
    public static final String CHANGE_TICKET_PATH = "/api/v1/auth/password/change";
    /**
     * Proof that the first sign-in factor (password or provider) was accepted while the second one is still due.
     * Opens nothing by itself: only {@code /login/2fa} reads it, together with a valid authenticator code.
     */
    public static final String MFA = "PDA_MFA";
    public static final String MFA_PATH = "/api/v1/auth/login";
    public static final String MFA_PURPOSE = "mfa_login";
    public static final Duration MFA_LIFETIME = Duration.ofMinutes(5);
    /**
     * Administrator sign-in, authenticator step: the password was right and the account has a confirmed authenticator.
     * Only {@code /auth/admin/login/2fa} receives it (cookie path) and accepts it; it is single use (server-side row).
     */
    public static final String ADMIN_MFA = "PDA_ADMIN_MFA";
    public static final String ADMIN_MFA_PATH = "/api/v1/auth/admin/login/2fa";
    /**
     * Administrator sign-in, first-time enrolment: the password was right but no authenticator is confirmed yet. Only
     * the two {@code /auth/admin/2fa/*} enrolment endpoints receive and accept it; single use, 10 minutes.
     */
    public static final String ADMIN_ENROLL = "PDA_ADMIN_ENROLL";
    public static final String ADMIN_ENROLL_PATH = "/api/v1/auth/admin/2fa";
    private final JwtTokens tokens;
    private final boolean production;

    public AuthCookies(JwtTokens tokens, @Value("${APP_ENV:dev}") String appEnv) {
        this.tokens = tokens;
        this.production = "prod".equalsIgnoreCase(appEnv) || "production".equalsIgnoreCase(appEnv);
    }

    public void write(LoginTokens pair, HttpServletRequest request, HttpServletResponse response) {
        add(response, ACCESS, pair.access(), "/api", tokens.accessLifetime(), request);
        add(response, REFRESH, pair.refresh(), "/api/v1/auth", tokens.refreshLifetime(), request);
        add(response, SESSION_HINT, "1", "/", tokens.refreshLifetime(), request);
    }

    public void clear(HttpServletRequest request, HttpServletResponse response) {
        add(response, ACCESS, "", "/api", Duration.ZERO, request);
        add(response, REFRESH, "", "/api/v1/auth", Duration.ZERO, request);
        add(response, SESSION_HINT, "", "/", Duration.ZERO, request);
    }

    /** Short-lived HttpOnly cookie that carries a single-purpose ticket (see {@link JwtTokens#issueTicket}). */
    public void writeTicket(String name, String path, JwtTokens.IssuedToken ticket, Duration lifetime,
                            HttpServletRequest request, HttpServletResponse response) {
        add(response, name, ticket.value(), path, lifetime, request);
    }

    public void clearTicket(String name, String path, HttpServletRequest request, HttpServletResponse response) {
        add(response, name, "", path, Duration.ZERO, request);
    }

    public String ticket(HttpServletRequest request, String name) { return read(request, name); }

    /** The password (or provider) step passed for this user; the second factor is still required. */
    public void writeSecondFactorPending(UUID userId, HttpServletRequest request, HttpServletResponse response) {
        writeTicket(MFA, MFA_PATH, tokens.issueTicket(userId, MFA_PURPOSE, "mfa", MFA_LIFETIME), MFA_LIFETIME,
                request, response);
    }

    public Optional<UUID> secondFactorPending(HttpServletRequest request) {
        return tokens.parseTicket(read(request, MFA), MFA_PURPOSE).map(JwtTokens.Ticket::userId);
    }

    public void clearSecondFactorPending(HttpServletRequest request, HttpServletResponse response) {
        clearTicket(MFA, MFA_PATH, request, response);
    }

    /** Logout: forget every half-finished sign-in proof (regular second step and both administrator tickets). */
    public void clearSignInTickets(HttpServletRequest request, HttpServletResponse response) {
        clearTicket(MFA, MFA_PATH, request, response);
        clearTicket(ADMIN_MFA, ADMIN_MFA_PATH, request, response);
        clearTicket(ADMIN_ENROLL, ADMIN_ENROLL_PATH, request, response);
    }

    public String access(HttpServletRequest request) { return read(request, ACCESS); }
    public String refresh(HttpServletRequest request) { return read(request, REFRESH); }

    private void add(HttpServletResponse response, String name, String value, String path,
                     Duration lifetime, HttpServletRequest request) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true).secure(production || request.isSecure())
                .sameSite("Lax").path(path).maxAge(lifetime).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
    }

    private static String read(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return null;
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> name.equals(cookie.getName()))
                .findFirst().map(jakarta.servlet.http.Cookie::getValue).orElse(null);
    }
}
