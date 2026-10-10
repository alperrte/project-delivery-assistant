package com.pda.auth.api;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.application.service.PasswordChangeCodeService;
import com.pda.auth.application.service.PasswordResetService;
import com.pda.auth.application.service.PasswordResetService.ResetResult;
import com.pda.auth.application.service.RegistrationWorkflow;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.auth.infrastructure.config.SecurityBaselineConfiguration;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import com.pda.auth.application.service.MailLocale;
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
    @MockitoBean PasswordChangeCodeService changeCodes;
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
        verify(passwordReset).forgot("member@example.test", MailLocale.TR);
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
    void resetVerifyRejectsANonSixDigitCode() throws Exception {
        Cookie cookie = csrfCookie();
        mvc.perform(post("/api/v1/auth/password/reset/verify").with(request -> {
                    request.setRemoteAddr("198.51.100.21");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"member@example.test\",\"code\":\"12x456\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields[0]").value("code"));
    }

    @Test
    void resetVerifyRequiresCsrf() throws Exception {
        mvc.perform(post("/api/v1/auth/password/reset/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"member@example.test\",\"code\":\"123456\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void resetVerifyHandsOutTheTicketOnlyForACorrectCode() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"code\":\"123456\"}";
        UUID userId = UUID.randomUUID();
        JwtTokens.IssuedToken ticket = new JwtTokens.IssuedToken("ticket-value", Instant.parse("2026-01-01T00:10:00Z"));
        when(passwordReset.verifyCode("member@example.test", "123456"))
                .thenReturn(new PasswordResetService.CodeCheck(ResetResult.RESET, userId, "42"));
        when(tokens.issueTicket(eq(userId), eq("pwd_reset"), eq("42"), any())).thenReturn(ticket);

        mvc.perform(post("/api/v1/auth/password/reset/verify").with(request -> {
                    request.setRemoteAddr("198.51.100.22");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"));
        verify(cookies).writeTicket(eq(AuthCookies.RESET_TICKET), eq(AuthCookies.RESET_TICKET_PATH), eq(ticket), any(),
                any(), any());

        record Case(ResetResult result, String detail, String code) {}
        int ip = 23;
        for (Case c : new Case[] {
                new Case(ResetResult.EXPIRED, "Reset code has expired", "reset_code_expired"),
                new Case(ResetResult.TOO_MANY_ATTEMPTS, "Too many attempts; request a new code", "reset_too_many_attempts"),
                new Case(ResetResult.INVALID, "Reset code is invalid", "reset_code_invalid")}) {
            String address = "198.51.100." + ip++;
            when(passwordReset.verifyCode("member@example.test", "123456"))
                    .thenReturn(new PasswordResetService.CodeCheck(c.result(), null, null));
            mvc.perform(post("/api/v1/auth/password/reset/verify").with(request -> {
                        request.setRemoteAddr(address);
                        return request;
                    }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail").value(c.detail()))
                    .andExpect(jsonPath("$.code").value(c.code()));
        }
        verify(cookies, times(1)).writeTicket(any(), any(), any(), any(), any(), any());
    }

    @Test
    void resetRejectsMismatchedConfirmationBeforeReachingTheService() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"newPassword\":\"New-password-1\",\"confirmPassword\":\"different-password\"}";
        mvc.perform(post("/api/v1/auth/password/reset").cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Password confirmation does not match"))
                .andExpect(jsonPath("$.code").value("password_confirmation_mismatch"));
    }

    @Test
    void resetRejectsAWeakPassword() throws Exception {
        Cookie cookie = csrfCookie();
        mvc.perform(post("/api/v1/auth/password/reset").with(request -> {
                    request.setRemoteAddr("198.51.100.26");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"newPassword\":\"aaaaaaaa\",\"confirmPassword\":\"aaaaaaaa\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields[0]").value("newPassword"));
    }

    @Test
    void resetWithoutAValidTicketIsRefused() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"newPassword\":\"New-password-1\",\"confirmPassword\":\"New-password-1\"}";
        mvc.perform(post("/api/v1/auth/password/reset").with(request -> {
                    request.setRemoteAddr("198.51.100.27");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_ticket_invalid"));
        verify(passwordReset, never()).reset(any(), any(), any());
    }

    @Test
    void resetWithAValidTicketSetsThePasswordAndClearsTheTicket() throws Exception {
        Cookie cookie = csrfCookie();
        UUID userId = UUID.randomUUID();
        String body = "{\"newPassword\":\"New-password-1\",\"confirmPassword\":\"New-password-1\"}";
        when(cookies.ticket(any(), eq(AuthCookies.RESET_TICKET))).thenReturn("ticket-value");
        when(tokens.parseTicket("ticket-value", "pwd_reset")).thenReturn(Optional.of(new JwtTokens.Ticket(userId, "42")));
        when(passwordReset.reset(userId, "42", "New-password-1")).thenReturn(ResetResult.RESET);

        mvc.perform(post("/api/v1/auth/password/reset").with(request -> {
                    request.setRemoteAddr("198.51.100.28");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"));
        verify(cookies).clearTicket(eq(AuthCookies.RESET_TICKET), eq(AuthCookies.RESET_TICKET_PATH), any(), any());

        when(passwordReset.reset(userId, "42", "New-password-1")).thenReturn(ResetResult.INVALID);
        mvc.perform(post("/api/v1/auth/password/reset").with(request -> {
                    request.setRemoteAddr("198.51.100.29");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_ticket_invalid"));
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
