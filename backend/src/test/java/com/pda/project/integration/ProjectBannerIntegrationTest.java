package com.pda.project.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.shared.TestImages;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Project banner: upload, replace and remove, strict type and size checks, role and CSRF rules. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectBannerIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    // Real images: the server reads the type and the size from the bytes, so fake headers are refused.
    private static final byte[] PNG = TestImages.png(2, 2);
    private static final byte[] JPEG = TestImages.jpeg(2, 2);
    private static final byte[] WEBP = TestImages.webp();
    private static final int TWO_MB = 2 * 1024 * 1024;

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
    @Autowired ProjectMembershipService memberships;

    @Test
    void bannerRoundTripWithSafeResponseHeadersAndIndependentFromTheLogo() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("banner");
        UUID projectId = createProject(manager, csrf, "Banner project");

        mvc.perform(get("/api/v1/projects/" + projectId + "/banner").cookie(manager.access()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(manager.access()))
                .andExpect(jsonPath("$.bannerVersion").doesNotExist());

        for (byte[] image : new byte[][] {PNG, JPEG, WEBP}) {
            mvc.perform(upload(projectId, image, "whatever.bin").cookie(csrf, manager.access())
                            .header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isNoContent());
        }

        // The last upload (WebP) wins; the type comes from the bytes and the browser is told not to sniff.
        var response = mvc.perform(get("/api/v1/projects/" + projectId + "/banner").cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/webp"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("immutable")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.startsWith("inline")))
                .andReturn().getResponse();
        assertArrayEquals(WEBP, response.getContentAsByteArray());

        mvc.perform(get("/api/v1/projects/" + projectId).cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bannerVersion").isNumber())
                .andExpect(jsonPath("$.logoVersion").doesNotExist());
        // The logo is a separate image: it does not exist just because a banner does.
        mvc.perform(get("/api/v1/projects/" + projectId + "/logo").cookie(manager.access()))
                .andExpect(status().isNotFound());

        mvc.perform(delete("/api/v1/projects/" + projectId + "/banner").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects/" + projectId + "/banner").cookie(manager.access()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(manager.access()))
                .andExpect(jsonPath("$.bannerVersion").doesNotExist());
    }

    @Test
    void bannerUploadRejectsDisguisedOversizedAndEmptyFiles() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("badbanner");
        UUID projectId = createProject(manager, csrf, "Strict banner");

        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
                .getBytes(StandardCharsets.UTF_8);
        mvc.perform(upload(projectId, svg, "banner.png", "image/png").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT_BANNER_INVALID_TYPE"));
        mvc.perform(upload(projectId, "GIF89a".getBytes(StandardCharsets.UTF_8), "banner.png", "image/png")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT_BANNER_INVALID_TYPE"));

        byte[] tooLarge = TestImages.pngPaddedTo(TWO_MB + 1);
        mvc.perform(upload(projectId, tooLarge, "banner.png").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT_BANNER_TOO_LARGE"));

        // Exactly the limit is accepted.
        byte[] atLimit = TestImages.pngPaddedTo(TWO_MB);
        mvc.perform(upload(projectId, atLimit, "banner.png").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/banner").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());

        mvc.perform(upload(projectId, new byte[0], "banner.png").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT_BANNER_EMPTY"));

        // A small file that claims to be 10000 x 10000 is refused from its header, before anything decodes it.
        mvc.perform(upload(projectId, TestImages.pngHeaderClaiming(10_000, 10_000), "bomb.png")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT_BANNER_DIMENSIONS"));

        // Nothing was stored by any rejected attempt.
        mvc.perform(get("/api/v1/projects/" + projectId + "/banner").cookie(manager.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void bannerEndpointsEnforceCsrfMembershipAndRole() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("bowner");
        Account analyst = account("banalyst");
        Account outsider = account("boutsider");
        UUID projectId = createProject(manager, csrf, "Guarded banner");
        memberships.addMember(manager.id(), projectId, analyst.id(), Set.of(ProjectRole.ANALYST));
        mvc.perform(upload(projectId, PNG, "banner.png").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());

        // No CSRF token.
        mvc.perform(upload(projectId, PNG, "banner.png").cookie(manager.access()))
                .andExpect(status().isForbidden());
        // A member without PROJECT_UPDATE may view but not change or remove.
        mvc.perform(get("/api/v1/projects/" + projectId + "/banner").cookie(analyst.access()))
                .andExpect(status().isOk());
        mvc.perform(upload(projectId, JPEG, "banner.jpg").cookie(csrf, analyst.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/banner").cookie(csrf, analyst.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        // A non-member cannot even read it.
        mvc.perform(get("/api/v1/projects/" + projectId + "/banner").cookie(outsider.access()))
                .andExpect(status().isForbidden());
        mvc.perform(upload(projectId, PNG, "banner.png").cookie(csrf, outsider.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        // Unauthenticated.
        mvc.perform(get("/api/v1/projects/" + projectId + "/banner")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/banner").cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
    }

    private static MockMultipartHttpServletRequestBuilder upload(UUID projectId, byte[] data, String filename) {
        return upload(projectId, data, filename, MediaType.APPLICATION_OCTET_STREAM_VALUE);
    }

    private static MockMultipartHttpServletRequestBuilder upload(UUID projectId, byte[] data, String filename,
                                                                 String contentType) {
        return multipart(HttpMethod.PUT, "/api/v1/projects/" + projectId + "/banner")
                .file(new MockMultipartFile("file", filename, contentType, data));
    }

    private UUID createProject(Account actor, Cookie csrf, String name) throws Exception {
        var response = mvc.perform(post("/api/v1/projects").cookie(csrf, actor.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        return UUID.fromString(JsonPath.read(response.getContentAsString(), "$.id"));
    }

    private Account account(String prefix) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String email = prefix + suffix + "@example.test";
        String password = UUID.randomUUID().toString();
        UUID id = users.registerLocal(email, "u" + suffix, password);
        Cookie csrf = csrfCookie();
        var login = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .with(request -> { request.setRemoteAddr("test-" + suffix); return request; })
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie access = cookie(login.getHeaders(HttpHeaders.SET_COOKIE), "PDA_ACCESS");
        assertFalse(access.getValue().isBlank());
        return new Account(id, access);
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private static Cookie cookie(java.util.Collection<String> headers, String name) {
        String value = headers.stream().filter(header -> header.startsWith(name + "="))
                .findFirst().orElseThrow().split(";", 2)[0].substring(name.length() + 1);
        return new Cookie(name, value);
    }

    private record Account(UUID id, Cookie access) {
    }
}
