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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectCriterionApiIntegrationTest {

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
    void managerManagesCriteriaLifecycleWhileContributorOnlyViews() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("critmanager");
        Account contributor = account("critcontrib");
        UUID projectId = createProject(manager, csrf, "Criteria project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));

        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Auth done\"}"))
                .andExpect(status().isForbidden());

        var first = mvc.perform(post("/api/v1/projects/" + projectId + "/criteria")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Auth done\",\"description\":\"Login works\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.sortOrder").value(0))
                .andReturn().getResponse();
        UUID firstId = UUID.fromString(JsonPath.read(first.getContentAsString(), "$.id"));

        var second = mvc.perform(post("/api/v1/projects/" + projectId + "/criteria")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Project mgmt done\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.sortOrder").value(1))
                .andReturn().getResponse();
        UUID secondId = UUID.fromString(JsonPath.read(second.getContentAsString(), "$.id"));

        mvc.perform(get("/api/v1/projects/" + projectId + "/criteria").cookie(contributor.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(firstId.toString()));

        mvc.perform(put("/api/v1/projects/" + projectId + "/criteria/" + firstId)
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Hijacked\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/projects/" + projectId + "/criteria/" + firstId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Auth done (renamed)\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Auth done (renamed)"));

        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria/" + firstId + "/complete")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria/" + firstId + "/complete")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(true))
                .andExpect(jsonPath("$.completedBy").value(manager.id().toString()));
        // Already completed.
        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria/" + firstId + "/complete")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria/" + firstId + "/uncomplete")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(false));

        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria/reorder")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderedCriterionIds\":[\"" + secondId + "\",\"" + firstId + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(secondId.toString()))
                .andExpect(jsonPath("$[1].id").value(firstId.toString()));
        // Missing one criterion from the reorder list.
        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria/reorder")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderedCriterionIds\":[\"" + secondId + "\"]}"))
                .andExpect(status().isBadRequest());

        mvc.perform(delete("/api/v1/projects/" + projectId + "/criteria/" + firstId)
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/criteria/" + firstId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects/" + projectId + "/criteria").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void criteriaAreScopedToTheirOwnProjectAndRequireAuthentication() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("critmanager2");
        UUID projectId = createProject(manager, csrf, "Criteria scope project");
        UUID otherProjectId = createProject(manager, csrf, "Other criteria project");

        mvc.perform(get("/api/v1/projects/" + projectId + "/criteria")).andExpect(status().isUnauthorized());

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/criteria")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Scoped criterion\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID criterionId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));

        mvc.perform(put("/api/v1/projects/" + otherProjectId + "/criteria/" + criterionId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Cross project\"}"))
                .andExpect(status().isNotFound());

        // An authenticated user who is not a member of this project (not just "no cookie at all") is denied too.
        Account outsider = account("critoutsider2");
        mvc.perform(get("/api/v1/projects/" + projectId + "/criteria").cookie(outsider.access()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/criteria")
                        .cookie(csrf, outsider.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Not my project\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void everyContributorRoleIsDeniedEveryCriteriaMutation() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("critmanager3");
        UUID projectId = createProject(manager, csrf, "Criteria role matrix project");

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/criteria")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Matrix criterion\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID criterionId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));

        for (ProjectRole role : ProjectRole.values()) {
            if (role == ProjectRole.PROJECT_MANAGER) {
                continue;
            }
            Account holder = account("critrole" + role.name().toLowerCase());
            memberships.addMember(manager.id(), projectId, holder.id(), Set.of(role));

            mvc.perform(post("/api/v1/projects/" + projectId + "/criteria")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Denied\"}"))
                    .andExpect(status().isForbidden());
            mvc.perform(put("/api/v1/projects/" + projectId + "/criteria/" + criterionId)
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Denied\"}"))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/projects/" + projectId + "/criteria/" + criterionId + "/complete")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/projects/" + projectId + "/criteria/reorder")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"orderedCriterionIds\":[\"" + criterionId + "\"]}"))
                    .andExpect(status().isForbidden());
            mvc.perform(delete("/api/v1/projects/" + projectId + "/criteria/" + criterionId)
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden());
        }
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
