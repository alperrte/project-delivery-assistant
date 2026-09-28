package com.pda.auth.api;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
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
                + "\"password\":\"valid password phrase\",\"confirmPassword\":\"valid password phrase\"}";
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
                + "\"password\":\"valid password phrase\",\"confirmPassword\":\"different password\"}";
        mvc.perform(post("/api/v1/auth/register").cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Password confirmation does not match"))
                .andExpect(header().string("Cache-Control", "no-store"));

        doThrow(new UserRegistrationConflictException()).when(workflow)
                .register(anyString(), anyString(), anyString(), anyString());
        body = "{\"email\":\"member@example.test\",\"nickname\":\"member_1\","
                + "\"password\":\"valid password phrase\",\"confirmPassword\":\"valid password phrase\"}";
        mvc.perform(post("/api/v1/auth/register").cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void invalidFieldResponseNamesFieldsWithoutEchoingInput() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"nickname\":\"bad-name\","
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
    void eightCharacterPasswordIsAccepted() throws Exception {
        Cookie cookie = csrfCookie();
        String body = "{\"email\":\"member@example.test\",\"nickname\":\"sample_user\","
                + "\"password\":\"eight888\",\"confirmPassword\":\"eight888\"}";
        mvc.perform(post("/api/v1/auth/register").with(request -> {
                    request.setRemoteAddr("203.0.113.22");
                    return request;
                }).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }
}
