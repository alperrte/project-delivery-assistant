package com.pda.project.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.GitHubIntegrationException;
import com.pda.project.application.service.GitHubIntegrationException.Reason;
import com.pda.project.application.service.GitHubRepositoryClient;
import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;
import com.pda.project.application.service.GitHubRepositoryClient.RepositoryMetadata;
import com.pda.project.application.service.ProjectCriterionService;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectHomeApiIntegrationTest {

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
        // The test re-stubs GitHub between calls, so the read cache must not remember earlier answers.
        registry.add("pda.github.cache-ttl", () -> "PT0S");
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired ProjectMembershipService memberships;
    @Autowired ProjectCriterionService criteria;
    @MockitoBean GitHubRepositoryClient gitHub;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    @Test
    void homeSummaryCapabilityDoesNotGrantCoManagerOrganizationAccess() throws Exception {
        Account owner=account("summaryowner"),co=account("summaryco");Cookie csrf=csrfCookie();
        var org=mvc.perform(post("/api/v1/organizations").cookie(csrf,owner.access()).header("X-XSRF-TOKEN",csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Summary org\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        String oid=JsonPath.read(org.getContentAsString(),"$.id");
        var p=mvc.perform(post("/api/v1/projects").cookie(csrf,owner.access()).header("X-XSRF-TOKEN",csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Summary project\",\"organizationId\":\""+oid+"\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        String pid=JsonPath.read(p.getContentAsString(),"$.id");
        memberships.addMember(owner.id(),UUID.fromString(pid),co.id(),Set.of(ProjectRole.PROJECT_MANAGER));
        mvc.perform(get("/api/v1/projects/"+pid+"/home").cookie(owner.access())).andExpect(status().isOk()).andExpect(jsonPath("$.organization.canViewOrganization").value(true));
        mvc.perform(get("/api/v1/projects/"+pid+"/home").cookie(co.access())).andExpect(status().isOk())
                .andExpect(jsonPath("$.organization.name").value("Summary org")).andExpect(jsonPath("$.organization.canViewOrganization").value(false));
        mvc.perform(get("/api/v1/organizations/"+oid).cookie(co.access())).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/projects/"+pid).cookie(csrf,co.access()).header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Co saved\",\"priority\":\"MEDIUM\",\"status\":\"PLANNING\",\"organizationId\":\""+oid+"\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.organizationId").value(oid));
    }

    @Test
    void archivedOrganizationRetainsAssociationWithoutPoisoningHomeTransaction() throws Exception {
        Cookie csrf=csrfCookie(); Account owner=account("archivedhome"), outsider=account("archivedoutsider");
        var org=mvc.perform(post("/api/v1/organizations").cookie(csrf,owner.access())
                .header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Retained org\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        String oid=JsonPath.read(org.getContentAsString(),"$.id");
        var created=mvc.perform(post("/api/v1/projects").cookie(csrf,owner.access()).header("X-XSRF-TOKEN",csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Retained project\",\"organizationId\":\""+oid+"\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        String pid=JsonPath.read(created.getContentAsString(),"$.id");
        mvc.perform(post("/api/v1/organizations/"+oid+"/archive").cookie(csrf,owner.access()).header("X-XSRF-TOKEN",csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects/"+pid+"/home").cookie(owner.access())).andExpect(status().isOk()).andExpect(jsonPath("$.organization").doesNotExist());
        mvc.perform(get("/api/v1/projects/"+pid).cookie(owner.access())).andExpect(status().isOk()).andExpect(jsonPath("$.organizationId").value(oid));
        assertEquals(UUID.fromString(oid),jdbc.queryForObject("select organization_id from projects where id=?",UUID.class,UUID.fromString(pid)));
        mvc.perform(get("/api/v1/projects/"+pid+"/home").cookie(outsider.access())).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/projects/"+pid).cookie(csrf,owner.access()).header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Edited\",\"priority\":\"HIGH\",\"status\":\"PLANNING\",\"organizationId\":\""+oid+"\"}"))
                .andExpect(status().isOk());
        mvc.perform(put("/api/v1/projects/"+pid).cookie(csrf,owner.access()).header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Edited\",\"priority\":\"HIGH\",\"status\":\"PLANNING\",\"organizationId\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.organizationId").doesNotExist());
        mvc.perform(post("/api/v1/projects").cookie(csrf,owner.access()).header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Rejected\",\"organizationId\":\""+oid+"\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void memberSeesHomeAggregateWhileOutsiderIsDenied() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("homemanager");
        Account contributor = account("homecontrib");
        Account outsider = account("homeoutsider");
        UUID projectId = createProject(manager, csrf, "Home project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));

        mvc.perform(get("/api/v1/projects/" + projectId + "/home").cookie(outsider.access()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects/" + projectId + "/home"))
                .andExpect(status().isUnauthorized());

        mvc.perform(get("/api/v1/projects/" + projectId + "/home").cookie(contributor.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Home project"))
                .andExpect(jsonPath("$.status").value("PLANNING"))
                .andExpect(jsonPath("$.priority").value("MEDIUM"))
                .andExpect(jsonPath("$.organization").doesNotExist())
                .andExpect(jsonPath("$.managers[0].userId").value(manager.id().toString()))
                .andExpect(jsonPath("$.managers[0].nickname").isNotEmpty())
                .andExpect(jsonPath("$.managers.length()").value(1))
                .andExpect(jsonPath("$.teamMemberCount").value(2))
                .andExpect(jsonPath("$.criteriaProgress.completed").value(0))
                .andExpect(jsonPath("$.criteriaProgress.total").value(0))
                .andExpect(jsonPath("$.repository.connected").value(false));
    }

    @Test
    void organizationCriteriaProgressAndRepositoryStateAppearInHome() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("homeorgmanager");
        var org = mvc.perform(post("/api/v1/organizations").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Home Org\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID organizationId = UUID.fromString(JsonPath.read(org.getContentAsString(), "$.id"));
        var created = mvc.perform(post("/api/v1/projects").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Org linked\",\"organizationId\":\"" + organizationId + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID projectId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));

        var criterion = criteria.create(manager.id(), projectId, "Ship MVP", null);
        criteria.create(manager.id(), projectId, "Write docs", null);
        criteria.complete(manager.id(), projectId, criterion.getId());

        mvc.perform(get("/api/v1/projects/" + projectId + "/home").cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organization.id").value(organizationId.toString()))
                .andExpect(jsonPath("$.organization.name").value("Home Org"))
                .andExpect(jsonPath("$.criteriaProgress.completed").value(1))
                .andExpect(jsonPath("$.criteriaProgress.total").value(2));

        Mockito.when(gitHub.fetchMetadata("alperrte", "project-delivery-assistant"))
                .thenReturn(new RepositoryMetadata("main", false));
        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://github.com/alperrte/project-delivery-assistant\"}"))
                .andExpect(status().isCreated());

        Mockito.when(gitHub.fetchLatestCommits("alperrte", "project-delivery-assistant", "main", 1))
                .thenReturn(List.of(new CommitSummary("abcdef1234567890", "abcdef1", "Fix bug", "Alper", "alperrte",
                        null, Instant.parse("2026-09-27T10:00:00Z"), "https://github.com/a/b/commit/abcdef1")));
        mvc.perform(get("/api/v1/projects/" + projectId + "/home").cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repository.connected").value(true))
                .andExpect(jsonPath("$.repository.repositoryOwner").value("alperrte"))
                .andExpect(jsonPath("$.repository.trackingMode").value("BASIC"))
                .andExpect(jsonPath("$.repository.notifyOnCommits").value(true))
                .andExpect(jsonPath("$.repository.lastCommit.shortSha").value("abcdef1"))
                .andExpect(jsonPath("$.repository.githubUnavailable").value(false));

        // GitHub failing never fails Project Home: it surfaces as its own safe "unavailable" state.
        Mockito.when(gitHub.fetchLatestCommits("alperrte", "project-delivery-assistant", "main", 1))
                .thenThrow(new GitHubIntegrationException(Reason.RATE_LIMITED, "GitHub rate limit reached"));
        mvc.perform(get("/api/v1/projects/" + projectId + "/home").cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repository.connected").value(true))
                .andExpect(jsonPath("$.repository.lastCommit").doesNotExist())
                .andExpect(jsonPath("$.repository.githubUnavailable").value(true));
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
