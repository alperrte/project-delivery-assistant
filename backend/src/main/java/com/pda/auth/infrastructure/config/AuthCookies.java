package com.pda.auth.infrastructure.config;

import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.application.service.LocalLoginService.LoginTokens;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthCookies {

    public static final String ACCESS = "PDA_ACCESS";
    public static final String REFRESH = "PDA_REFRESH";
    private final JwtTokens tokens;
    private final boolean production;

    public AuthCookies(JwtTokens tokens, @Value("${APP_ENV:dev}") String appEnv) {
        this.tokens = tokens;
        this.production = "prod".equalsIgnoreCase(appEnv) || "production".equalsIgnoreCase(appEnv);
    }

    public void write(LoginTokens pair, HttpServletRequest request, HttpServletResponse response) {
        add(response, ACCESS, pair.access(), "/api", tokens.accessLifetime(), request);
        add(response, REFRESH, pair.refresh(), "/api/v1/auth", tokens.refreshLifetime(), request);
    }

    public void clear(HttpServletRequest request, HttpServletResponse response) {
        add(response, ACCESS, "", "/api", Duration.ZERO, request);
        add(response, REFRESH, "", "/api/v1/auth", Duration.ZERO, request);
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
