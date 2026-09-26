package com.pda.auth.application;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.application.service.LocalLoginService.LoginTokens;
import com.pda.auth.infrastructure.config.AuthCookies;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class AuthCookiesTest {

    @Test
    void productionCookiesAreSecureHttpOnlyHostOnlyAndLax() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        JwtTokens tokens = new JwtTokens(Base64.getEncoder().encodeToString(bytes), 15, 7, Clock.systemUTC());
        AuthCookies cookies = new AuthCookies(tokens, "prod");
        var response = new MockHttpServletResponse();
        cookies.write(new LoginTokens(UUID.randomUUID().toString(), UUID.randomUUID().toString()),
                new MockHttpServletRequest(), response);
        assertTrue(response.getHeaders("Set-Cookie").stream().allMatch(value ->
                value.contains("HttpOnly") && value.contains("Secure") && value.contains("SameSite=Lax")
                        && !value.contains("Domain=")));
    }
}
