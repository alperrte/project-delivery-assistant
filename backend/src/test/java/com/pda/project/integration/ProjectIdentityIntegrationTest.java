package com.pda.project.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Project identity: type, tagline, last editor, the logo endpoints and the aggregated card data of the list. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectIdentityIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0};
    private static final byte[] WEBP = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        registry.add("API_DOCS_ENABLED", () -> "true");
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired ProjectMembershipService memberships;

    @Test
    void createStoresTypeTaglineAndTechStackAndCreatorIsLastEditor() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("identity");

        mvc.perform(post("/api/v1/projects").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Identity\",\"projectType\":\"MOBILE\",\"tagline\":\"Ship faster\","
                                + "\"techStack\":\"Flutter, Firebase\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projectType").value("MOBILE"))
                .andExpect(jsonPath("$.tagline").value("Ship faster"))
                .andExpect(jsonPath("$.techStack").value("Flutter, Firebase"))
                .andExpect(jsonPath("$.logoVersion").doesNotExist());

        // Older clients that send neither type nor tagline still work and get the neutral default.
        mvc.perform(post("/api/v1/projects").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Legacy client\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projectType").value("OTHER"))
                .andExpect(jsonPath("$.tagline").doesNotExist());

        mvc.perform(post("/api/v1/projects").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Too long\",\"tagline\":\"" + "x".repeat(121) + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/projects").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Bad type\",\"projectType\":\"SPACESHIP\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateChangesTypeTaglineAndLastEditor() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("editor");
        UUID projectId = createProject(manager, csrf, "Editable");

        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Editable\",\"priority\":\"LOW\",\"status\":\"PLANNING\","
                                + "\"projectType\":\"AI\",\"tagline\":\"Smarter\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectType").value("AI"))
                .andExpect(jsonPath("$.tagline").value("Smarter"));

        // A missing type keeps the current one; a missing tagline clears it.
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Editable\",\"priority\":\"LOW\",\"status\":\"PLANNING\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectType").value("AI"))
                .andExpect(jsonPath("$.tagline").doesNotExist());

        // The list shows who changed the project last, including a change by a different manager.
        Account second = account("secondmanager");
        memberships.addMember(manager.id(), projectId, second.id(), Set.of(ProjectRole.PROJECT_MANAGER));
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, second.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Editable\",\"priority\":\"HIGH\",\"status\":\"PLANNING\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/projects").cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].updatedBy.userId").value(second.id().toString()))
                .andExpect(jsonPath("$.content[0].updatedBy.nickname").isNotEmpty());
    }

    @Test
    void listCarriesTeamCountAndPreviewManagersFirstCappedAtFive() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("lister");
        UUID projectId = createProject(manager, csrf, "Crowded");
        createProject(account("solo"), csrf, "Solo");
        for (int i = 0; i < 6; i++) {
            Account member = account("member" + i);
            memberships.addMember(manager.id(), projectId, member.id(), Set.of(ProjectRole.ANALYST));
        }

        mvc.perform(get("/api/v1/projects").cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(projectId.toString()))
                .andExpect(jsonPath("$.content[0].team.memberCount").value(7))
                .andExpect(jsonPath("$.content[0].team.preview.length()").value(5))
                .andExpect(jsonPath("$.content[0].team.preview[0].userId").value(manager.id().toString()))
                .andExpect(jsonPath("$.content[0].team.preview[0].nickname").isNotEmpty());
    }

    @Test
    void logoRoundTripWithSafeResponseHeaders() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("logo");
        UUID projectId = createProject(manager, csrf, "Logo project");

        mvc.perform(get("/api/v1/projects/" + projectId + "/logo").cookie(manager.access()))
                .andExpect(status().isNotFound());

        for (byte[] image : new byte[][] {PNG, JPEG, WEBP}) {
            mvc.perform(upload(projectId, image, "whatever.bin").cookie(csrf, manager.access())
                            .header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isNoContent());
        }

        // The last upload (WebP) wins; type comes from the bytes, nothing is sniffed by the browser.
        var response = mvc.perform(get("/api/v1/projects/" + projectId + "/logo").cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/webp"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("immutable")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.startsWith("inline")))
                .andReturn().getResponse();
        assertArrayEquals(WEBP, response.getContentAsByteArray());

        mvc.perform(get("/api/v1/projects/" + projectId).cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.logoVersion").isNumber());

        mvc.perform(delete("/api/v1/projects/" + projectId + "/logo").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects/" + projectId + "/logo").cookie(manager.access()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(manager.access()))
                .andExpect(jsonPath("$.logoVersion").doesNotExist());
    }

    @Test
    void logoUploadRejectsDisguisedOversizedAndEmptyFiles() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("badlogo");
        UUID projectId = createProject(manager, csrf, "Strict logo");

        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
                .getBytes(StandardCharsets.UTF_8);
        mvc.perform(upload(projectId, svg, "logo.png", "image/png").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT_LOGO_INVALID_TYPE"));
        mvc.perform(upload(projectId, "GIF89a".getBytes(StandardCharsets.UTF_8), "logo.png", "image/png")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT_LOGO_INVALID_TYPE"));

        byte[] tooLarge = new byte[513 * 1024];
        System.arraycopy(PNG, 0, tooLarge, 0, PNG.length);
        mvc.perform(upload(projectId, tooLarge, "logo.png").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT_LOGO_TOO_LARGE"));

        mvc.perform(upload(projectId, new byte[0], "logo.png").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT_LOGO_EMPTY"));

        // Nothing was stored by any rejected attempt.
        mvc.perform(get("/api/v1/projects/" + projectId + "/logo").cookie(manager.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void logoEndpointsEnforceCsrfMembershipAndRole() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("owner");
        Account analyst = account("analyst");
        Account outsider = account("outsider");
        UUID projectId = createProject(manager, csrf, "Guarded logo");
        memberships.addMember(manager.id(), projectId, analyst.id(), Set.of(ProjectRole.ANALYST));
        mvc.perform(upload(projectId, PNG, "logo.png").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());

        // No CSRF token.
        mvc.perform(upload(projectId, PNG, "logo.png").cookie(manager.access()))
                .andExpect(status().isForbidden());
        // A member without PROJECT_UPDATE may view but not change or remove.
        mvc.perform(get("/api/v1/projects/" + projectId + "/logo").cookie(analyst.access()))
                .andExpect(status().isOk());
        mvc.perform(upload(projectId, JPEG, "logo.jpg").cookie(csrf, analyst.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/logo").cookie(csrf, analyst.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        // A non-member cannot even read it.
        mvc.perform(get("/api/v1/projects/" + projectId + "/logo").cookie(outsider.access()))
                .andExpect(status().isForbidden());
        mvc.perform(upload(projectId, PNG, "logo.png").cookie(csrf, outsider.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        // Unauthenticated.
        mvc.perform(get("/api/v1/projects/" + projectId + "/logo")).andExpect(status().isUnauthorized());
    }

    private static MockMultipartHttpServletRequestBuilder upload(UUID projectId, byte[] data, String filename) {
        return upload(projectId, data, filename, MediaType.APPLICATION_OCTET_STREAM_VALUE);
    }

    private static MockMultipartHttpServletRequestBuilder upload(UUID projectId, byte[] data, String filename,
                                                                 String contentType) {
        return multipart(HttpMethod.PUT, "/api/v1/projects/" + projectId + "/logo")
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
