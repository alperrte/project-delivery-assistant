package com.pda.user.integration;

import com.pda.BackendApplication;
import com.pda.user.UserAccounts;
import com.pda.user.application.service.UserPreferenceService;
import com.pda.user.domain.ThemeColors;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import com.pda.shared.testing.TestPostgres;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
    static TestPostgres postgres = new TestPostgres("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        // Test-only: verify the published OpenAPI contract without changing any ENV file.
        registry.add("API_DOCS_ENABLED", () -> "true");
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserPreferenceService preferenceService;

    @Test
    void openApiDescribesColorSettingsAndTheScopedResetOperation() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/preferences'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/preferences'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/preferences/theme'].delete.summary").value("Reset my theme colors"))
                .andExpect(jsonPath("$.paths['/api/v1/users/me/preferences'].put.responses['400']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/preferences/theme'].delete.responses['403']").exists())
                .andExpect(jsonPath("$.components.schemas.PreferencesRequest.properties.themeColors").exists())
                .andExpect(jsonPath("$.components.schemas.ThemeColorsRequest.properties.gradientAngle.minimum").value(0))
                .andExpect(jsonPath("$.components.schemas.ThemeColorsRequest.properties.gradientAngle.maximum").value(360));
    }

    private static final String COLORS = """
            {"themeType":"GRADIENT","solidColor":"#abc","gradientStartColor":"#001122",\
            "gradientEndColor":"#ffeedd","gradientAngle":360}
            """.strip();

    private static String colorBody(String colors) {
        return "{\"locale\":\"de\",\"theme\":\"dark\",\"motion\":\"off\",\"themeTransition\":false,"
                + "\"languageTransition\":false,\"navbarMode\":\"auto-hide\",\"themeColors\":" + colors + "}";
    }

    @Test
    void themeColorsDefaultWithoutWritingAndPersistAcrossSessionsAndLegacySaves() throws Exception {
        Cookie csrf = csrfCookie();
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String email = "colors" + suffix + "@example.test";
        String password = UUID.randomUUID().toString();
        UUID userId = users.registerLocal(email, "c" + suffix.substring(0, 16), password);
        Cookie owner = signIn(email, password);
        mvc.perform(get(PATH).cookie(owner)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.themeColors.themeType").value("SOLID"))
                .andExpect(jsonPath("$.themeColors.solidColor").value("#1B5FE0"))
                .andExpect(jsonPath("$.themeColors.gradientAngle").value(135));
        assertEquals(0, jdbc.queryForObject("select count(*) from user_preferences where user_id=?", Integer.class, userId));
        mvc.perform(put(PATH).cookie(csrf, owner).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(colorBody(COLORS)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.themeColors.themeType").value("GRADIENT"))
                .andExpect(jsonPath("$.themeColors.solidColor").value("#AABBCC"))
                .andExpect(jsonPath("$.themeColors.gradientStartColor").value("#001122"))
                .andExpect(jsonPath("$.themeColors.gradientEndColor").value("#FFEEDD"))
                .andExpect(jsonPath("$.themeColors.gradientAngle").value(360));
        assertEquals("#AABBCC", jdbc.queryForObject("select solid_color from user_preferences where user_id=?", String.class, userId));
        Cookie nextSession = signIn(email, password);
        mvc.perform(get(PATH).cookie(nextSession)).andExpect(jsonPath("$.themeColors.gradientEndColor").value("#FFEEDD"));

        for (String legacyBody : new String[]{body("tr", "light", "on", "true"), colorBody("null")}) {
            mvc.perform(put(PATH).cookie(csrf, owner).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content(legacyBody))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.themeColors.themeType").value("GRADIENT"))
                    .andExpect(jsonPath("$.themeColors.solidColor").value("#AABBCC"));
        }
        for (String appearance : new String[]{"light", "dark", "system"}) {
            mvc.perform(put(PATH).cookie(csrf, owner).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content(colorBody(COLORS.replace("GRADIENT", "SOLID"))
                                    .replace("\"theme\":\"dark\"", "\"theme\":\"" + appearance + "\"")))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.theme").value(appearance))
                    .andExpect(jsonPath("$.themeColors.themeType").value("SOLID"));
        }
    }

    @Test
    void resettingColorsIsIdempotentAndPreservesEveryOtherPreferenceAndOtherUsers() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie owner = login("resetcolors");
        Cookie other = login("othercolors");
        for (Cookie user : new Cookie[]{owner, other}) {
            mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                    .contentType(MediaType.APPLICATION_JSON).content(colorBody(COLORS))).andExpect(status().isOk());
        }
        for (int i = 0; i < 2; i++) {
            mvc.perform(delete(PATH + "/theme").cookie(csrf, owner).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.themeColors.themeType").value("SOLID"))
                    .andExpect(jsonPath("$.themeColors.solidColor").value("#1B5FE0"))
                    .andExpect(jsonPath("$.themeColors.gradientStartColor").value("#1B5FE0"))
                    .andExpect(jsonPath("$.themeColors.gradientEndColor").value("#8B5CF6"))
                    .andExpect(jsonPath("$.themeColors.gradientAngle").value(135))
                    .andExpect(jsonPath("$.locale").value("de")).andExpect(jsonPath("$.theme").value("dark"))
                    .andExpect(jsonPath("$.motion").value("off")).andExpect(jsonPath("$.themeTransition").value(false))
                    .andExpect(jsonPath("$.languageTransition").value(false)).andExpect(jsonPath("$.navbarMode").value("auto-hide"));
        }
        mvc.perform(get(PATH).cookie(other)).andExpect(jsonPath("$.themeColors.themeType").value("GRADIENT"));
        Cookie neverSaved = login("defaultcolors");
        mvc.perform(delete(PATH + "/theme").cookie(csrf, neverSaved).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.locale").doesNotExist())
                .andExpect(jsonPath("$.theme").doesNotExist()).andExpect(jsonPath("$.motion").doesNotExist())
                .andExpect(jsonPath("$.themeColors.solidColor").value("#1B5FE0"));
    }

    @Test
    void invalidColorsAndAnglesAreAtomicSafeBadRequests() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie user = login("invalidcolors");
        mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(colorBody(COLORS))).andExpect(status().isOk());
        for (String invalid : new String[]{COLORS.replace("GRADIENT", "ANIMATED"), COLORS.replace("\"GRADIENT\"", "0"),
                COLORS.replace("#abc", "red"), COLORS.replace("#abc", "#12345678"),
                COLORS.replace("#001122", "#xyz"), COLORS.replace("#ffeedd", "url(example.test)"),
                COLORS.replace("360", "-1"), COLORS.replace("360", "361"), COLORS.replace("360", "12.5"),
                COLORS.replace("360", "null"), COLORS.replace("\"#abc\"", "null"), "{}"}) {
            mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content(colorBody(invalid).replace("\"de\"", "\"en\"")))
                    .andExpect(status().isBadRequest()).andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.detail").value("Invalid request"));
        }
        mvc.perform(get(PATH).cookie(user)).andExpect(jsonPath("$.locale").value("de"))
                .andExpect(jsonPath("$.themeColors.gradientAngle").value(360));
        mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(colorBody(COLORS.replace("360", "0"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.themeColors.gradientAngle").value(0));
    }

    @Test
    void themeReadsWritesAndResetRequireSessionCsrfAndAnOwnRoute() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie user = login("securecolors");
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(put(PATH).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(colorBody(COLORS))).andExpect(status().isUnauthorized());
        mvc.perform(delete(PATH + "/theme").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(put(PATH).cookie(user).contentType(MediaType.APPLICATION_JSON).content(colorBody(COLORS)))
                .andExpect(status().isForbidden());
        mvc.perform(delete(PATH + "/theme").cookie(user)).andExpect(status().isForbidden());
        String foreign = "/api/v1/users/" + UUID.randomUUID() + "/preferences";
        mvc.perform(get(foreign).cookie(user)).andExpect(status().isForbidden());
        mvc.perform(put(foreign).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(colorBody(COLORS))).andExpect(status().isForbidden());
        mvc.perform(delete(foreign + "/theme").cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(get(PATH).cookie(user)).andExpect(jsonPath("$.themeColors.themeType").value("SOLID"));
    }

    @Test
    void simultaneousFirstSaveAndColorResetPreserveUnrelatedDefaults() throws Exception {
        for (int i = 0; i < 4; i++) {
            String suffix = UUID.randomUUID().toString().replace("-", "");
            UUID userId = users.registerLocal("race" + suffix + "@example.test", "r" + suffix.substring(0, 16), UUID.randomUUID().toString());
            var ready = new java.util.concurrent.CountDownLatch(2);
            var start = new java.util.concurrent.CountDownLatch(1);
            try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
                var save = executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return preferenceService.save(userId, "en", "light", "off", false, false, "always-visible");
                });
                var reset = executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return preferenceService.resetThemeColors(userId);
                });
                org.junit.jupiter.api.Assertions.assertTrue(ready.await(5, java.util.concurrent.TimeUnit.SECONDS));
                start.countDown();
                save.get(15, java.util.concurrent.TimeUnit.SECONDS);
                reset.get(15, java.util.concurrent.TimeUnit.SECONDS);
            }
            var saved = preferenceService.get(userId);
            assertEquals("en", saved.locale());
            assertEquals("light", saved.theme());
            assertEquals("off", saved.motion());
            assertEquals(false, saved.themeTransition());
            assertEquals(false, saved.languageTransition());
            assertEquals("always-visible", saved.navbarMode());
            assertEquals(ThemeColors.DEFAULT, saved.themeColors());
            assertEquals(1, jdbc.queryForObject("select count(*) from user_preferences where user_id=?", Integer.class, userId));
        }
    }

    private static String body(String locale, String theme, String motion, String themeTransition) {
        return "{\"locale\":\"" + locale + "\",\"theme\":\"" + theme + "\",\"motion\":\"" + motion
                + "\",\"themeTransition\":" + themeTransition + "}";
    }

    private static String bodyWithLang(String locale, String theme, String motion, String themeTransition, String languageTransition) {
        return "{\"locale\":\"" + locale + "\",\"theme\":\"" + theme + "\",\"motion\":\"" + motion
                + "\",\"themeTransition\":" + themeTransition + ",\"languageTransition\":" + languageTransition + "}";
    }

    private static String navbarBody(String mode) {
        String base = body("tr", "system", "on", "true");
        return base.substring(0, base.length() - 1) + ",\"navbarMode\":\"" + mode + "\"}";
    }


    @Test
    void navbarChoicesPersistAndOlderClientsDoNotResetThem() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie owner = login("navbarprefs");
        Cookie other = login("othernavbar");
        mvc.perform(get(PATH).cookie(owner)).andExpect(jsonPath("$.navbarMode").doesNotExist());
        for (String mode : new String[]{"auto-hide", "always-visible"}) {
            mvc.perform(put(PATH).cookie(csrf, owner).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content(navbarBody(mode)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.navbarMode").value(mode));
            mvc.perform(get(PATH).cookie(owner)).andExpect(jsonPath("$.navbarMode").value(mode));
            mvc.perform(get(PATH).cookie(other)).andExpect(jsonPath("$.navbarMode").doesNotExist());
        }
        mvc.perform(put(PATH).cookie(csrf, owner).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body("en", "dark", "off", "false")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.navbarMode").value("always-visible"));
        mvc.perform(put(PATH).cookie(csrf, owner).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(navbarBody("invalid")))
                .andExpect(status().isBadRequest());
        mvc.perform(get(PATH).cookie(owner)).andExpect(jsonPath("$.navbarMode").value("always-visible"));
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
                        .contentType(MediaType.APPLICATION_JSON).content(navbarBody("auto-hide")))
                .andExpect(status().isOk());

        // Signing out and in again creates a new session; the defaults are the same.
        Cookie second = signIn(email, password);
        mvc.perform(get(PATH).cookie(second))
                .andExpect(jsonPath("$.navbarMode").value("auto-hide"));

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

    @Test
    void languageTransitionChoicesPersistAndWorkIndependentlyOfTheme() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie user = login("langprefs");

        // Null until saved
        mvc.perform(get(PATH).cookie(user)).andExpect(jsonPath("$.languageTransition").doesNotExist());

        // Theme transition OFF, Language transition ON
        mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(bodyWithLang("tr", "light", "on", "false", "true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.themeTransition").value(false))
                .andExpect(jsonPath("$.languageTransition").value(true));

        mvc.perform(get(PATH).cookie(user))
                .andExpect(jsonPath("$.themeTransition").value(false))
                .andExpect(jsonPath("$.languageTransition").value(true));

        // Theme transition ON, Language transition OFF
        mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(bodyWithLang("en", "dark", "on", "true", "false")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.themeTransition").value(true))
                .andExpect(jsonPath("$.languageTransition").value(false));

        mvc.perform(get(PATH).cookie(user))
                .andExpect(jsonPath("$.themeTransition").value(true))
                .andExpect(jsonPath("$.languageTransition").value(false));

        // Both OFF
        mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(bodyWithLang("de", "system", "on", "false", "false")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.themeTransition").value(false))
                .andExpect(jsonPath("$.languageTransition").value(false));

        // Older client payload omitting languageTransition preserves previous false choice
        mvc.perform(put(PATH).cookie(csrf, user).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body("de", "system", "on", "true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.themeTransition").value(true))
                .andExpect(jsonPath("$.languageTransition").value(false));
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
