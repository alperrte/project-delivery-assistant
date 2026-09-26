package com.pda.project.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.user.UserAccounts;
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
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectApiIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

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
    @Autowired ProjectRepository projects;
    @Autowired JdbcTemplate jdbc;

    @Test
    void creatorBecomesManagerAndCrossProjectAccessIsDenied() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("manager");
        Account outsider = account("outsider");

        mvc.perform(post("/api/v1/projects").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"No CSRF\"}"))
                .andExpect(status().isForbidden());
        var created = mvc.perform(post("/api/v1/projects").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Öğrenci Projesi\",\"description\":\"First project\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PLANNING"))
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                .andReturn().getResponse();
        UUID projectId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));
        assertTrue(created.getHeader(HttpHeaders.LOCATION).endsWith(projectId.toString()));
        assertEquals("PROJECT_MANAGER", jdbc.queryForObject(
                "SELECT r.role FROM project_membership_roles r JOIN project_memberships m ON m.id = r.membership_id "
                        + "WHERE m.project_id = ? AND m.user_id = ?", String.class, projectId, manager.id()));

        mvc.perform(get("/api/v1/projects").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/projects"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects").cookie(outsider.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(outsider.access()))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, outsider.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Taken\",\"priority\":\"HIGH\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects/by-slug/" + JsonPath.read(created.getContentAsString(), "$.slug"))
                        .cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(projectId.toString()));

        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Updated\",\"priority\":\"HIGH\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.priority").value("HIGH"));
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(manager.access())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Unprotected\",\"priority\":\"HIGH\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/archive").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        assertNotNull(projects.findById(projectId).orElseThrow().getArchivedAt());
        mvc.perform(delete("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
    }

    @Test
    void organizationOwnerControlsMutationsAndProjectListUsesMembership() throws Exception {
        Cookie csrf = csrfCookie();
        Account owner = account("owner");
        Account other = account("other");
        var created = mvc.perform(post("/api/v1/organizations").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"PDA Team\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID organizationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));
        mvc.perform(put("/api/v1/organizations/" + organizationId).cookie(csrf, other.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Stolen\"}"))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/projects").cookie(csrf, other.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Wrong owner\",\"organizationId\":\"" + organizationId + "\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Linked\",\"organizationId\":\"" + organizationId + "\"}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/v1/organizations/" + organizationId + "/projects").cookie(owner.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/organizations/" + organizationId + "/projects").cookie(other.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/organizations").cookie(owner.access())
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000"))
                .andExpect(status().isOk())
                .andExpect(result -> assertEquals("http://localhost:3000",
                        result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)));
        mvc.perform(post("/api/v1/organizations/" + organizationId + "/archive").cookie(csrf, other.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/organizations/" + organizationId + "/archive").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/organizations/" + organizationId).cookie(owner.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void validationAndSwaggerExposeSafeContracts() throws Exception {
        Cookie csrf = csrfCookie();
        Account actor = account("validation");
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/actuator/info")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects").cookie(csrf, actor.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields[0]").value("name"));
        mvc.perform(get("/api/v1/projects?size=101").cookie(actor.access()))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/projects'].post.responses['201']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/organizations'].post.responses['201']").exists());
    }

    private Account account(String prefix) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String email = prefix + suffix + "@example.test";
        String password = UUID.randomUUID().toString();
        UUID id = users.registerLocal(email, "u" + suffix, password);
        Cookie csrf = csrfCookie();
        var login = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
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
