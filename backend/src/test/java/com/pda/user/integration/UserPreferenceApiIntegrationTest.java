package com.pda.user.integration;

import com.pda.BackendApplication;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A user's saved interface defaults: nothing until saved, replaced as a whole, private to the user. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class UserPreferenceApiIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    private static final String PATH = "/api/v1/users/me/preferences";

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;

    private static String body(String locale, String theme, String motion, String themeTransition) {
        return "{\"locale\":\"" + locale + "\",\"theme\":\"" + theme + "\",\"motion\":\"" + motion
                + "\",\"themeTransition\":" + themeTransition + "}";
    }

    @Test
    void nothingIsSavedUntilTheUserSavesAndThenAllFourChoicesComeBack() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie user = login("prefs");

        // The browser (another origin) must be allowed to call it, with the session cookie.
        mvc.perform(get(PATH).cookie(user).header("Origin", "http://localhost:3000"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Access-Control-Allow-Origin", "http://localhost:3000"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Access-Control-Allow-Credentials", "true"));

        // A user who never saved has no defaults: the browser keeps what it has.
        mvc.perform(get(PATH).cookie(user))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locale").doesNotExist())
                .andExpect(jsonPath("$.theme").doesNotExist());

        mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body("de", "dark", "off", "false")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locale").value("de"));

        mvc.perform(get(PATH).cookie(user))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locale").value("de"))
                .andExpect(jsonPath("$.theme").value("dark"))
                .andExpect(jsonPath("$.motion").value("off"))
                .andExpect(jsonPath("$.themeTransition").value(false));

        // Saving again replaces everything.
        mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body("tr", "light", "on", "true")))
                .andExpect(status().isOk());
        mvc.perform(get(PATH).cookie(user))
                .andExpect(jsonPath("$.locale").value("tr"))
                .andExpect(jsonPath("$.theme").value("light"))
                .andExpect(jsonPath("$.themeTransition").value(true));
    }

    @Test
    void savedDefaultsBelongToTheirOwnerAndSurviveANewSignIn() throws Exception {
        Cookie csrf = csrfCookie();
        String email = "again" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "@example.test";
        String password = UUID.randomUUID().toString();
        users.registerLocal(email, "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 16), password);
        Cookie first = signIn(email, password);
        Cookie other = login("otherprefs");

        mvc.perform(put(PATH).cookie(csrf, first).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body("en", "dark", "system", "true")))
                .andExpect(status().isOk());

        // Signing out and in again creates a new session; the defaults are the same.
        Cookie second = signIn(email, password);
        mvc.perform(get(PATH).cookie(second))
                .andExpect(jsonPath("$.locale").value("en"))
                .andExpect(jsonPath("$.theme").value("dark"));

        // Somebody else sees none of it.
        mvc.perform(get(PATH).cookie(other)).andExpect(jsonPath("$.locale").doesNotExist());
    }

    @Test
    void unsupportedValuesCsrfAndMissingSessionAreRefused() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie user = login("badprefs");

        for (String invalid : new String[] {
                body("fr", "dark", "off", "true"), body("tr", "blue", "off", "true"),
                body("tr", "dark", "fast", "true"), "{\"locale\":\"tr\",\"theme\":\"dark\",\"motion\":\"off\"}"}) {
            mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content(invalid))
                    .andExpect(status().isBadRequest());
        }
        // No CSRF token.
        mvc.perform(put(PATH).cookie(user).contentType(MediaType.APPLICATION_JSON).content(body("tr", "dark", "off", "true")))
                .andExpect(status().isForbidden());
        // Not signed in: 401, so the client can renew the session instead of showing a permission error.
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(put(PATH).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body("tr", "dark", "off", "true")))
                .andExpect(status().isUnauthorized());
        // Nothing was stored by the refused attempts.
        mvc.perform(get(PATH).cookie(user)).andExpect(jsonPath("$.locale").doesNotExist());
    }

    private Cookie login(String prefix) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String email = prefix + suffix + "@example.test";
        String password = UUID.randomUUID().toString();
        users.registerLocal(email, "u" + suffix, password);
        return signIn(email, password);
    }

    private Cookie signIn(String email, String password) throws Exception {
        Cookie csrf = csrfCookie();
        String ip = "test-" + UUID.randomUUID();
        var response = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .with(request -> { request.setRemoteAddr(ip); return request; })
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        String value = response.getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(header -> header.startsWith("PDA_ACCESS=")).findFirst().orElseThrow()
                .split(";", 2)[0].substring("PDA_ACCESS=".length());
        assertFalse(value.isBlank());
        return new Cookie("PDA_ACCESS", value);
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }
}
