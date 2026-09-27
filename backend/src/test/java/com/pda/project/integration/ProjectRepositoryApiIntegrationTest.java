package com.pda.project.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.GitHubIntegrationException;
import com.pda.project.application.service.GitHubIntegrationException.Reason;
import com.pda.project.application.service.GitHubRepositoryClient;
import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;
import com.pda.project.application.service.GitHubRepositoryClient.RepositoryMetadata;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectRepositoryApiIntegrationTest {

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
    @MockitoBean GitHubRepositoryClient gitHub;

    @Test
    void managerConnectsRepositoryWhileContributorOnlyViewsAndReadsCommits() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("repomanager");
        Account contributor = account("repocontrib");
        UUID projectId = createProject(manager, csrf, "Repo project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));

        Mockito.when(gitHub.fetchMetadata("alperrte", "project-delivery-assistant"))
                .thenReturn(new RepositoryMetadata("main"));

        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://github.com/alperrte/project-delivery-assistant\"}"))
                .andExpect(status().isForbidden());
        // SSRF-unsafe host is rejected before any client call, regardless of who calls it.
        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://evil.com/owner/repo\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://github.com/alperrte/project-delivery-assistant\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.repositoryOwner").value("alperrte"))
                .andExpect(jsonPath("$.repositoryName").value("project-delivery-assistant"))
                .andExpect(jsonPath("$.defaultBranch").value("main"));

        mvc.perform(get("/api/v1/projects/" + projectId + "/repository").cookie(contributor.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.repositoryOwner").value("alperrte"));

        Mockito.when(gitHub.fetchLatestCommits("alperrte", "project-delivery-assistant", "main", 10))
                .thenReturn(List.of(new CommitSummary("abcdef1", "Fix bug", "Alper", null,
                        Instant.parse("2026-09-27T10:00:00Z"), "https://github.com/a/b/commit/abcdef1")));
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository/commits").cookie(contributor.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].shortSha").value("abcdef1"))
                .andExpect(jsonPath("$[0].message").value("Fix bug"));

        // GitHub failing does not take down the rest of the API: it surfaces as its own safe status.
        Mockito.when(gitHub.fetchLatestCommits("alperrte", "project-delivery-assistant", "main", 10))
                .thenThrow(new GitHubIntegrationException(Reason.RATE_LIMITED, "GitHub rate limit reached"));
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository/commits").cookie(contributor.access()))
                .andExpect(status().isTooManyRequests());
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(contributor.access())).andExpect(status().isOk());

        mvc.perform(delete("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository").cookie(manager.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void connectSurfacesGitHubNotFoundSafely() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("repomanager2");
        UUID projectId = createProject(manager, csrf, "Repo not found project");
        Mockito.when(gitHub.fetchMetadata("owner", "missing"))
                .thenThrow(new GitHubIntegrationException(Reason.NOT_FOUND, "GitHub repository not found"));

        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://github.com/owner/missing\"}"))
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
