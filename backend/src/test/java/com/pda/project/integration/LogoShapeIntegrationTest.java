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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Logo shape round trips against real PostgreSQL, retaining media and access boundaries. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class LogoShapeIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    // Real images: the server reads the type and the size from the bytes, so fake headers are refused.
    private static final byte[] PNG = TestImages.png(2, 2);
    private static final byte[] JPEG = TestImages.jpeg(2, 2);
    private static final byte[] WEBP = TestImages.webp();

    @org.junit.jupiter.api.io.TempDir
    static java.nio.file.Path mediaDirectory;

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
        registry.add("pda.organization.media.storage-path", () -> mediaDirectory.toString());
    }

    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired ProjectMembershipService memberships;

    @Test
    void projectShapePersistsWithoutChangingLogoAndLegacyUpdatesPreserveIt() throws Exception {
        Cookie csrf = csrfCookie();
        Account owner = account("shape");
        UUID id = createProject(owner, csrf, "Legacy square");
        String path = "/api/v1/projects/" + id;
        mvc.perform(get(path).cookie(owner.access())).andExpect(jsonPath("$.logoShape").value("SQUARE"));
        mvc.perform(upload(id, PNG, "logo.png").cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        Long version = jdbc.queryForObject("SELECT EXTRACT(EPOCH FROM logo_updated_at)*1000 FROM projects WHERE id=?", Long.class, id);
        String body = "{\"name\":\"Circle\",\"priority\":\"MEDIUM\",\"status\":\"PLANNING\"";
        mvc.perform(put(path).cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body + ",\"logoShape\":\"CIRCLE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.logoShape").value("CIRCLE"));
        mvc.perform(get(path).cookie(owner.access())).andExpect(jsonPath("$.logoShape").value("CIRCLE"));
        mvc.perform(get("/api/v1/projects/by-slug/" + jdbc.queryForObject("SELECT slug FROM projects WHERE id=?", String.class, id))
                .cookie(owner.access())).andExpect(jsonPath("$.logoShape").value("CIRCLE"));
        mvc.perform(get("/api/v1/projects").cookie(owner.access())).andExpect(jsonPath("$.content[0].logoShape").value("CIRCLE"));
        assertArrayEquals(PNG, mvc.perform(get(path + "/logo").cookie(owner.access())).andReturn().getResponse().getContentAsByteArray());
        org.junit.jupiter.api.Assertions.assertEquals(version, jdbc.queryForObject("SELECT EXTRACT(EPOCH FROM logo_updated_at)*1000 FROM projects WHERE id=?", Long.class, id));
        mvc.perform(put(path).cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.logoShape").value("CIRCLE"));
        mvc.perform(delete(path + "/logo").cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNoContent());
        mvc.perform(get(path).cookie(owner.access())).andExpect(jsonPath("$.logoShape").value("CIRCLE")).andExpect(jsonPath("$.logoVersion").doesNotExist());
        mvc.perform(upload(id, JPEG, "replacement.jpg").cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNoContent());
        mvc.perform(put(path).cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body + ",\"logoShape\":\"SQUARE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.logoShape").value("SQUARE"));
        assertArrayEquals(JPEG, mvc.perform(get(path + "/logo").cookie(owner.access())).andReturn().getResponse().getContentAsByteArray());
    }

    @Test
    void organizationShapeIsIndependentAndMediaSurvivesShapeChanges() throws Exception {
        Cookie csrf = csrfCookie();
        Account owner = account("orgshape");
        var created = mvc.perform(post("/api/v1/organizations").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Round organization\",\"logoShape\":\"CIRCLE\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.logoShape").value("CIRCLE")).andReturn().getResponse();
        String id = JsonPath.read(created.getContentAsString(), "$.id");
        String path = "/api/v1/organizations/" + id;
        mvc.perform(multipart(HttpMethod.PUT, path + "/logo").file(new MockMultipartFile("file", "logo.png", "image/png", PNG))
                .cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNoContent());
        String key = jdbc.queryForObject("SELECT logo_key FROM organizations WHERE id=?", String.class, UUID.fromString(id));
        var project = mvc.perform(post("/api/v1/projects").cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Independent\",\"organizationId\":\"" + id + "\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.logoShape").value("SQUARE")).andReturn().getResponse();
        String projectId = JsonPath.read(project.getContentAsString(), "$.id");
        mvc.perform(put(path).cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Square organization\",\"logoShape\":\"SQUARE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.logoShape").value("SQUARE")).andExpect(jsonPath("$.logoVersion").value(key));
        mvc.perform(put(path).cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Circle again\",\"logoShape\":\"CIRCLE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.logoShape").value("CIRCLE"));
        mvc.perform(put(path).cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Legacy update\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.logoShape").value("CIRCLE"));
        mvc.perform(get(path).cookie(owner.access())).andExpect(jsonPath("$.logoShape").value("CIRCLE"));
        mvc.perform(get("/api/v1/organizations").cookie(owner.access())).andExpect(jsonPath("$.content[0].logoShape").value("CIRCLE"));
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(owner.access())).andExpect(jsonPath("$.logoShape").value("SQUARE"));
        assertArrayEquals(PNG, mvc.perform(get(path + "/logo").cookie(owner.access())).andReturn().getResponse().getContentAsByteArray());
        mvc.perform(delete(path + "/logo").cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNoContent());
        mvc.perform(get(path).cookie(owner.access())).andExpect(jsonPath("$.logoShape").value("CIRCLE")).andExpect(jsonPath("$.logoVersion").doesNotExist());
        mvc.perform(post("/api/v1/organizations").cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Legacy organization\"}")).andExpect(status().isCreated()).andExpect(jsonPath("$.logoShape").value("SQUARE"));
    }

    @Test
    void invalidShapesAndUnauthorizedUpdatesAreRejected() throws Exception {
        Cookie csrf = csrfCookie();
        Account owner = account("guard");
        Account outsider = account("out");
        UUID id = createProject(owner, csrf, "Guarded");
        String projectPath = "/api/v1/projects/" + id;
        String valid = "{\"name\":\"Guarded\",\"priority\":\"MEDIUM\",\"status\":\"PLANNING\",\"logoShape\":\"CIRCLE\"}";
        mvc.perform(put(projectPath).cookie(owner.access()).contentType(MediaType.APPLICATION_JSON).content(valid)).andExpect(status().isForbidden());
        mvc.perform(put(projectPath).cookie(csrf, outsider.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON).content(valid)).andExpect(status().isForbidden());
        mvc.perform(put(projectPath).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON).content(valid)).andExpect(status().isUnauthorized());
        var org = mvc.perform(post("/api/v1/organizations").cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Guarded org\"}")).andExpect(status().isCreated()).andReturn().getResponse();
        String orgPath = "/api/v1/organizations/" + JsonPath.read(org.getContentAsString(), "$.id");
        mvc.perform(put(orgPath).cookie(csrf, outsider.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Bad\",\"logoShape\":\"CIRCLE\"}")).andExpect(status().isForbidden());
        mvc.perform(put(orgPath).cookie(owner.access()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Bad\",\"logoShape\":\"CIRCLE\"}")).andExpect(status().isForbidden());
        for (String shape : new String[]{"\"TRIANGLE\"", "\"circle\"", "\"\"", "0", "1", "true", "{}", "[]"}) {
            for (String collection : new String[]{"projects", "organizations"}) {
                mvc.perform(post("/api/v1/" + collection).cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Invalid\",\"logoShape\":" + shape + "}"))
                        .andExpect(status().isBadRequest());
            }
            mvc.perform(put(projectPath).cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                    .content(valid.replace("\"CIRCLE\"", shape))).andExpect(status().isBadRequest());
            mvc.perform(put(orgPath).cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Invalid\",\"logoShape\":" + shape + "}")).andExpect(status().isBadRequest());
        }
        mvc.perform(get(projectPath).cookie(owner.access())).andExpect(jsonPath("$.logoShape").value("SQUARE"));
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
