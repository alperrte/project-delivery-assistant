package com.pda.auth.api;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.auth.application.service.RegistrationWorkflow;
import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import java.time.Clock;
import com.pda.user.UserRegistrationConflictException;
import com.pda.auth.infrastructure.config.SecurityBaselineConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import com.pda.auth.application.service.MailLocale;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthRegistrationController.class)
@Import(SecurityBaselineConfiguration.class)
@TestPropertySource(properties = "FRONTEND_URL=http://localhost:3000")
class AuthRegistrationHttpTest {

    @Autowired MockMvc mvc;
    @MockitoBean RegistrationWorkflow workflow;
    @MockitoBean JwtTokens tokens;
    @MockitoBean AuthCookies cookies;
    @MockitoBean UserAccounts users;
    @MockitoBean UserSessions sessions;
    @MockitoBean Clock clock;

    @Test
    void csrfCookieAndHeaderAreRequired() throws Exception {
        Cookie cookie = csrfCookie();
        assertFalse(cookie.isHttpOnly());
        String body = "{\"email\":\"member@example.test\",\"nickname\":\"member_1\","
                + "\"password\":\"Valid-Phrase-1\",\"confirmPassword\":\"Valid-Phrase-1\"}";
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/register").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/register").cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    @Test
    void corsAllowsConfiguredFrontendOnly() throws Exception {
        mvc.perform(options("/api/v1/auth/register").header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "x-xsrf-token,content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
        mvc.perform(options("/api/v1/auth/register").header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    @Test
    void registerLimitsFiveRequestsPerRemoteIp() throws Exception {
        Cookie cookie = csrfCookie();
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/auth/register").with(request -> {
                        request.setRemoteAddr("192.0.2.10");
                        return request;
                    }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                    .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/auth/register").with(request -> {
                    request.setRemoteAddr("192.0.2.10");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "600"));
    }

    @Test
    void registerLimitCountsRequestsRejectedByCsrf() throws Exception {
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/auth/register").with(request -> {
                        request.setRemoteAddr("198.51.100.10");
                        return request;
                    }))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/auth/register").with(request -> {
                    request.setRemoteAddr("198.51.100.10");
                    return request;
                }))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void loginLimitCountsRequestsRejectedByCsrf() throws Exception {
        for (int i = 0; i < 30; i++) {
            mvc.perform(post("/api/v1/auth/login").with(request -> {
                        request.setRemoteAddr("203.0.113.10");
                        return request;
                    }))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/auth/login").with(request -> {
                    request.setRemoteAddr("203.0.113.10");
                    return request;
                }))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void deferredVerificationRoutesAndOtherRoutesAreDenied() throws Exception {
        mvc.perform(post("/api/v1/auth/verify-email")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/resend-verification")).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/users")).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/auth/unknown")).andExpect(status().isForbidden());
    }

    @Test
    void invalidInputAndDuplicateIdentityUseSafeProblemDetails() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"nickname\":\"member_1\","
                + "\"password\":\"Valid-Phrase-1\",\"confirmPassword\":\"Different-Pass-1\"}";
        mvc.perform(post("/api/v1/auth/register").cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Password confirmation does not match"))
                .andExpect(header().string("Cache-Control", "no-store"));

        doThrow(new UserRegistrationConflictException()).when(workflow)
                .register(anyString(), anyString(), anyString(), anyString(), any(MailLocale.class));
        body = "{\"email\":\"member@example.test\",\"nickname\":\"member_1\","
                + "\"password\":\"Valid-Phrase-1\",\"confirmPassword\":\"Valid-Phrase-1\"}";
        mvc.perform(post("/api/v1/auth/register").cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void invalidFieldResponseNamesFieldsWithoutEchoingInput() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"nickname\":\"bad.name\","
                + "\"password\":\"short\",\"confirmPassword\":\"short\"}";
        mvc.perform(post("/api/v1/auth/register").with(request -> {
                    request.setRemoteAddr("203.0.113.20");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields[0]").value("nickname"))
                .andExpect(jsonPath("$.invalidFields[1]").value("password"))
                .andExpect(result -> assertFalse(result.getResponse().getContentAsString().contains("short")))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void spacedNicknamesAreAcceptedAndTrimmedOnRegisterAndInvitationRegister() throws Exception {
        Cookie cookie = csrfCookie();
        String[][] cases = {
                {"Hamza Taşbay", "Hamza Taşbay"}, {"  Hamza Taşbay  ", "Hamza Taşbay"},
                {"Çağrı Öztürk", "Çağrı Öztürk"},
                {"Ayşe-Nur", "Ayşe-Nur"}, {"Hamza_Taşbay-27", "Hamza_Taşbay-27"},
                {"\\tAli Veli\\n", "Ali Veli"}};
        int index = 0;
        for (String[] pair : cases) {
            String address = "203.0.115." + (++index);
            String json = "\"nickname\":\"" + pair[0] + "\",\"password\":\"Valid-pass1\","
                    + "\"confirmPassword\":\"Valid-pass1\"";
            mvc.perform(post("/api/v1/auth/register").with(request -> { request.setRemoteAddr(address); return request; })
                            .cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"member@example.test\"," + json + "}"))
                    .andExpect(status().isOk());
            verify(workflow).register(eq("member@example.test"), eq(pair[1]), eq("Valid-pass1"), eq("Valid-pass1"),
                    any(MailLocale.class));
            Mockito.clearInvocations(workflow);
            mvc.perform(post("/api/v1/auth/register/invitation")
                            .with(request -> { request.setRemoteAddr(address); return request; })
                            .cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"token\":\"token\",\"email\":\"member@example.test\",\"firstName\":\"A\","
                                    + "\"lastName\":\"B\"," + json + "}"))
                    .andExpect(status().isOk());
            verify(workflow).registerWithInvitation("token", "member@example.test", "A", "B", pair[1],
                    "Valid-pass1", "Valid-pass1");
            Mockito.clearInvocations(workflow);
        }
    }

    @Test
    void ambiguousOrUnsafeNicknamesAreFieldErrorsOnBothRegistrationRoutes() throws Exception {
        Cookie cookie = csrfCookie();
        String[] invalid = {"Hamza  Taşbay", "Hamza\\tTaşbay", "Hamza Taşbay", "Ha​mza", "Ha‍mza",
                "Ha﻿mza", "Ha⁠mza", "ab", "a".repeat(33), "   ", "<script>", "a@b", "a.b",
                "😀😀😀", "Hamza\\nTaşbay"};
        int index = 0;
        for (String value : invalid) {
            String address = "203.0.116." + (++index);
            String json = "\"nickname\":\"" + value + "\",\"password\":\"Valid-pass1\","
                    + "\"confirmPassword\":\"Valid-pass1\"";
            mvc.perform(post("/api/v1/auth/register").with(request -> { request.setRemoteAddr(address); return request; })
                            .cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"member@example.test\"," + json + "}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.invalidFields[0]").value("nickname"));
            mvc.perform(post("/api/v1/auth/register/invitation")
                            .with(request -> { request.setRemoteAddr(address); return request; })
                            .cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"token\":\"token\",\"email\":\"member@example.test\",\"firstName\":\"A\","
                                    + "\"lastName\":\"B\"," + json + "}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.invalidFields[0]").value("nickname"));
        }
        verifyNoInteractions(workflow);
    }

    @Test
    void sevenCharacterPasswordIsAFieldError() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"nickname\":\"sample_user\","
                + "\"password\":\"seven77\",\"confirmPassword\":\"seven77\"}";
        mvc.perform(post("/api/v1/auth/register").with(request -> {
                    request.setRemoteAddr("203.0.113.21");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Invalid request fields"))
                .andExpect(jsonPath("$.invalidFields[0]").value("password"));
    }

    @Test
    void eightCharacterPasswordWithAllRequiredClassesIsAccepted() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"nickname\":\"sample_user\","
                + "\"password\":\"Eight-88\",\"confirmPassword\":\"Eight-88\"}";
        mvc.perform(post("/api/v1/auth/register").with(request -> {
                    request.setRemoteAddr("203.0.113.22");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    @Test
    void verifyMapsEveryOutcomeToItsProblemCode() throws Exception {
        Cookie cookie = csrfCookie();
        record Case(RegistrationWorkflow.VerificationResult result, int status, String code) {}
        for (Case c : new Case[] {
                new Case(RegistrationWorkflow.VerificationResult.VERIFIED, 200, null),
                new Case(RegistrationWorkflow.VerificationResult.INVALID, 400, "verification_code_invalid"),
                new Case(RegistrationWorkflow.VerificationResult.EXPIRED, 400, "verification_code_expired"),
                new Case(RegistrationWorkflow.VerificationResult.TOO_MANY_ATTEMPTS, 400, "verification_too_many_attempts")}) {
            when(workflow.verify("member@example.test", "123456")).thenReturn(c.result());
            var performed = mvc.perform(post("/api/v1/auth/register/verify").with(request -> {
                        request.setRemoteAddr("203.0.113.30");
                        return request;
                    }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"member@example.test\",\"code\":\"123456\"}"))
                    .andExpect(status().is(c.status()))
                    .andExpect(header().string("Cache-Control", "no-store"));
            if (c.code() != null) {
                performed.andExpect(jsonPath("$.code").value(c.code()));
            }
        }
    }

    @Test
    void verifyRequiresCsrfAndASixDigitCode() throws Exception {
        Cookie cookie = csrfCookie();
        mvc.perform(post("/api/v1/auth/register/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"member@example.test\",\"code\":\"123456\"}"))
                .andExpect(status().isForbidden());
        for (String code : new String[] {"12345", "1234567", "abcdef", "12 456", ""}) {
            mvc.perform(post("/api/v1/auth/register/verify").with(request -> {
                        request.setRemoteAddr("203.0.113.31");
                        return request;
                    }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"member@example.test\",\"code\":\"" + code + "\"}"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void verifyLimitsFiveRequestsPerRemoteIp() throws Exception {
        Cookie cookie = csrfCookie();
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/auth/register/verify").with(request -> {
                        request.setRemoteAddr("192.0.2.30");
                        return request;
                    }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                    .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/auth/register/verify").with(request -> {
                    request.setRemoteAddr("192.0.2.30");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void resendAlwaysAnswersAcceptedAndPassesTheLanguage() throws Exception {
        Cookie cookie = csrfCookie();
        mvc.perform(post("/api/v1/auth/register/resend").with(request -> {
                    request.setRemoteAddr("203.0.113.32");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"member@example.test\",\"locale\":\"de\"}"))
                .andExpect(status().isAccepted())
                .andExpect(header().string("Cache-Control", "no-store"));
        verify(workflow).resend("member@example.test", MailLocale.DE);
        mvc.perform(post("/api/v1/auth/register/resend").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"member@example.test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void resendLimitsFiveRequestsPerRemoteIp() throws Exception {
        Cookie cookie = csrfCookie();
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/auth/register/resend").with(request -> {
                        request.setRemoteAddr("192.0.2.31");
                        return request;
                    }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                    .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/auth/register/resend").with(request -> {
                    request.setRemoteAddr("192.0.2.31");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void registerPassesTheRequestedLanguage() throws Exception {
        Cookie cookie = csrfCookie();
        mvc.perform(post("/api/v1/auth/register").with(request -> {
                    request.setRemoteAddr("203.0.113.33");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"member@example.test\",\"nickname\":\"sample_user\","
                        + "\"password\":\"Eight-88\",\"confirmPassword\":\"Eight-88\",\"locale\":\"en\"}"))
                .andExpect(status().isOk());
        verify(workflow).register("member@example.test", "sample_user", "Eight-88", "Eight-88", MailLocale.EN);
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }
}
