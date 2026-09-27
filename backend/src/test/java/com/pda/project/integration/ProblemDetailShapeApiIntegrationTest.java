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
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HMZ-PROJ-50: every controller-layer 400/403/404/409 returns a consistent {@code ProblemDetail} body
 * ({@code type}/{@code title}/{@code status}/{@code detail}), not just the right status code, and project/squad
 * endpoints never answer with 401 (the security layer always denies them as 403 instead; see
 * {@code SecurityBaselineConfiguration}'s auth-only 401 allowlist).
 */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProblemDetailShapeApiIntegrationTest {

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
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired ProjectMembershipService memberships;

    @Test
    void projectControllerReturnsConsistentProblemDetailShapes() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("pdmanager");
        Account contributor = account("pdcontrib");
        UUID projectId = createProject(manager, csrf, "ProblemDetail project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.ANALYST));

        // 400: bean validation failure.
        mvc.perform(post("/api/v1/projects").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Invalid request fields"))
                .andExpect(jsonPath("$.invalidFields[0]").value("name"));

        // 403: authenticated, a member, but not a manager (controller-layer, via AccessDeniedException).
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, contributor.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Hijack\",\"priority\":\"HIGH\",\"status\":\"PLANNING\"}"))
                .andExpect(status().isForbidden())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.detail").value("Access denied"));

        // 404: a real project, but the referenced member does not exist (a non-member always gets 403 on the
        // project resource itself, by design, so this sub-resource is where a genuine 404 is reachable).
        mvc.perform(get("/api/v1/projects/" + projectId + "/members/" + UUID.randomUUID())
                        .cookie(manager.access()))
                .andExpect(status().isNotFound())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Resource not found"));

        // 409: last Project Manager cannot leave.
        mvc.perform(delete("/api/v1/projects/" + projectId + "/members/" + manager.id())
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("Membership change conflicts with project rules"));

        // Project endpoints never answer 401: an unauthenticated call is always 403.
        mvc.perform(get("/api/v1/projects/" + projectId)).andExpect(status().isForbidden());
    }

    @Test
    void invitationControllerReturnsConsistentProblemDetailShapes() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("pdinvmanager");
        Account target = account("pdinvtarget");
        UUID projectId = createProject(manager, csrf, "ProblemDetail invite project");

        // 400: neither userId nor email set.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Invalid request"));

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID invitationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.invitationId"));

        // 403: not a manager.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/resend")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.detail").value("Access denied"));

        // 404: unknown invitation id.
        mvc.perform(delete("/api/v1/projects/" + projectId + "/invitations/" + UUID.randomUUID())
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Resource not found"));

        // 409: duplicate pending invitation for the same target.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"ANALYST\"]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("Invitation conflicts with existing project rules"));
    }

    @Test
    void criterionControllerReturnsConsistentProblemDetailShapes() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("pdcritmanager");
        Account contributor = account("pdcritcontrib");
        UUID projectId = createProject(manager, csrf, "ProblemDetail criteria project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.ANALYST));

        // 400: blank title.
        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Invalid request fields"));

        // 403: contributor cannot create.
        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Denied\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.detail").value("Access denied"));

        // 404: unknown criterion id.
        mvc.perform(put("/api/v1/projects/" + projectId + "/criteria/" + UUID.randomUUID())
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Missing\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Resource not found"));
    }

    @Test
    void squadControllerReturnsConsistentProblemDetailShapes() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("pdsqmanager");
        Account contributor = account("pdsqcontrib");
        UUID projectId = createProject(manager, csrf, "ProblemDetail squad project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.ANALYST));

        // 400: blank name.
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Invalid request fields"));

        // 403: contributor cannot create.
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Denied\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.detail").value("Access denied"));

        // 404: unknown squad id.
        mvc.perform(get("/api/v1/projects/" + projectId + "/squads/" + UUID.randomUUID())
                        .cookie(manager.access()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Resource not found"));

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Only Squad\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID squadId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + contributor.id() + "\"}"))
                .andExpect(status().isCreated());

        // 409: duplicate member add.
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + contributor.id() + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("Squad change conflicts with existing state"));

        mvc.perform(get("/api/v1/projects/" + projectId + "/squads")).andExpect(status().isForbidden());
    }

    @Test
    void repositoryControllerReturnsConsistentProblemDetailShapes() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("pdrepomanager");
        Account contributor = account("pdrepocontrib");
        UUID projectId = createProject(manager, csrf, "ProblemDetail repository project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.ANALYST));

        // 400: non-GitHub host, rejected before any client call.
        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://evil.com/a/b\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Invalid request"));

        // 403: contributor cannot connect.
        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://github.com/a/b\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.detail").value("Access denied"));

        // 404: no repository connected yet.
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository").cookie(manager.access()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Resource not found"));
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
