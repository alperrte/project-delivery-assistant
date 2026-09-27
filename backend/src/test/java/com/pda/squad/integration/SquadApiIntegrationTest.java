package com.pda.squad.integration;

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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SquadApiIntegrationTest {

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
    void managerManagesSquadLifecycleWhileContributorOnlyViews() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("sqhttpmanager");
        Account contributor = account("sqhttpcontrib");
        UUID projectId = createProject(manager, csrf, "Squad HTTP project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));

        mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Backend Squad\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(manager.access()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Backend Squad\"}"))
                .andExpect(status().isForbidden());

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Backend Squad\",\"description\":\"Owns the API\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Backend Squad"))
                .andReturn().getResponse();
        UUID squadId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));

        mvc.perform(get("/api/v1/projects/" + projectId + "/squads").cookie(contributor.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/projects/" + projectId + "/squads/" + squadId).cookie(contributor.access()))
                .andExpect(status().isOk());

        mvc.perform(put("/api/v1/projects/" + projectId + "/squads/" + squadId)
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Hijacked\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/projects/" + projectId + "/squads/" + squadId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed Squad\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Renamed Squad"));

        // Only an active project member can be added.
        Account outsider = account("sqhttpoutsider");
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + outsider.id() + "\"}"))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + contributor.id() + "\"}"))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + contributor.id() + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(contributor.id().toString()));
        // Duplicate add.
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + contributor.id() + "\"}"))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(contributor.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));

        mvc.perform(delete("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members/" + contributor.id())
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members/" + contributor.id())
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/archive")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/archive")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects/" + projectId + "/squads/" + squadId).cookie(manager.access()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/projects/" + projectId + "/squads").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void nonMembersAreDeniedAndSquadIsScopedToItsOwnProject() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("sqhttpmanager2");
        Account outsider = account("sqhttpoutsider2");
        UUID projectId = createProject(manager, csrf, "Squad scope project");
        UUID otherProjectId = createProject(manager, csrf, "Other scope project");

        mvc.perform(get("/api/v1/projects/" + projectId + "/squads")).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects/" + projectId + "/squads").cookie(outsider.access()))
                .andExpect(status().isForbidden());

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Scoped Squad\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID squadId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));

        // Same manager, but the squad does not belong to otherProjectId.
        mvc.perform(get("/api/v1/projects/" + otherProjectId + "/squads/" + squadId).cookie(manager.access()))
                .andExpect(status().isNotFound());
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
