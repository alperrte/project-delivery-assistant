package com.pda.auth.api;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.application.service.PasswordResetService;
import com.pda.auth.application.service.PasswordResetService.ResetResult;
import com.pda.auth.application.service.RegistrationWorkflow;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.auth.infrastructure.config.SecurityBaselineConfiguration;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

// AuthRegistrationController is included only so its GET /csrf endpoint is available to seed the cookie below;
// its own behaviour is covered by AuthRegistrationHttpTest.
@WebMvcTest(controllers = {AuthPasswordController.class, AuthRegistrationController.class})
@Import(SecurityBaselineConfiguration.class)
@TestPropertySource(properties = "FRONTEND_URL=http://localhost:3000")
class AuthPasswordHttpTest {

    @Autowired MockMvc mvc;
    @MockitoBean PasswordResetService passwordReset;
    @MockitoBean RegistrationWorkflow workflow;
    @MockitoBean UserAccounts users;
    @MockitoBean UserSessions sessions;
    @MockitoBean JwtTokens tokens;
    @MockitoBean AuthCookies cookies;
    @MockitoBean Clock clock;

    @Test
    void forgotRequiresCsrfAndAlwaysAccepts() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\"}";
        mvc.perform(post("/api/v1/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/password/forgot").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/password/forgot").cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isAccepted())
                .andExpect(header().string("Cache-Control", "no-store"));
        verify(passwordReset).forgot("member@example.test");
    }

    @Test
    void forgotRejectsAnInvalidEmailBeforeReachingTheService() throws Exception {
        Cookie cookie = csrfCookie();
        mvc.perform(post("/api/v1/auth/password/forgot").with(request -> {
                    request.setRemoteAddr("198.51.100.20");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"not-an-email\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields[0]").value("email"));
    }

    @Test
    void resetRejectsMismatchedConfirmationBeforeReachingTheService() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"code\":\"123456\","
                + "\"newPassword\":\"new-password-1\",\"confirmPassword\":\"different-password\"}";
        mvc.perform(post("/api/v1/auth/password/reset").cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Password confirmation does not match"))
                .andExpect(jsonPath("$.code").value("password_confirmation_mismatch"));
    }

    @Test
    void resetRejectsANonSixDigitCode() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"code\":\"12x456\","
                + "\"newPassword\":\"new-password-1\",\"confirmPassword\":\"new-password-1\"}";
        mvc.perform(post("/api/v1/auth/password/reset").with(request -> {
                    request.setRemoteAddr("198.51.100.21");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields[0]").value("code"));
    }

    @Test
    void resetMapsEachServiceOutcomeToItsResponse() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"code\":\"123456\","
                + "\"newPassword\":\"new-password-1\",\"confirmPassword\":\"new-password-1\"}";

        when(passwordReset.reset("member@example.test", "123456", "new-password-1")).thenReturn(ResetResult.RESET);
        mvc.perform(post("/api/v1/auth/password/reset").with(request -> {
                    request.setRemoteAddr("198.51.100.22");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"));

        when(passwordReset.reset(anyString(), anyString(), anyString())).thenReturn(ResetResult.EXPIRED);
        mvc.perform(post("/api/v1/auth/password/reset").with(request -> {
                    request.setRemoteAddr("198.51.100.23");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Reset code has expired"))
                .andExpect(jsonPath("$.code").value("reset_code_expired"));

        when(passwordReset.reset(anyString(), anyString(), anyString())).thenReturn(ResetResult.TOO_MANY_ATTEMPTS);
        mvc.perform(post("/api/v1/auth/password/reset").with(request -> {
                    request.setRemoteAddr("198.51.100.24");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Too many attempts; request a new code"))
                .andExpect(jsonPath("$.code").value("reset_too_many_attempts"));

        when(passwordReset.reset(anyString(), anyString(), anyString())).thenReturn(ResetResult.INVALID);
        mvc.perform(post("/api/v1/auth/password/reset").with(request -> {
                    request.setRemoteAddr("198.51.100.25");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Reset code is invalid"))
                .andExpect(jsonPath("$.code").value("reset_code_invalid"));
    }

    @Test
    void forgotLimitsFiveRequestsPerRemoteIp() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\"}";
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/auth/password/forgot").with(request -> {
                        request.setRemoteAddr("192.0.2.30");
                        return request;
                    }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isAccepted());
        }
        mvc.perform(post("/api/v1/auth/password/forgot").with(request -> {
                    request.setRemoteAddr("192.0.2.30");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "600"));
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }
}
