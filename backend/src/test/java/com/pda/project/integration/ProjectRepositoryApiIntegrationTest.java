package com.pda.project.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.GitHubIntegrationException;
import com.pda.project.application.service.GitHubIntegrationException.Reason;
import com.pda.project.application.service.GitHubRepositoryClient;
import com.pda.project.application.service.GitHubRepositoryClient.BranchComparison;
import com.pda.project.application.service.GitHubRepositoryClient.BranchPage;
import com.pda.project.application.service.GitHubRepositoryClient.BranchSummary;
import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;
import com.pda.project.application.service.GitHubRepositoryClient.RepositoryMetadata;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.project.infrastructure.repository.ProjectRepositoryConnectionRepository;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
        // Mock-based tests re-stub GitHub between calls, so the read cache must not remember earlier answers.
        registry.add("pda.github.cache-ttl", () -> "PT0S");
        registry.add("pda.github.read-limit-per-minute", () -> String.valueOf(READ_LIMIT));
    }

    private static final int READ_LIMIT = 40;

    @Autowired MockMvc mvc;
    @Autowired ProjectRepositoryConnectionRepository connections;
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
                .thenReturn(new RepositoryMetadata("main", false));
        Mockito.when(gitHub.fetchLatestCommits("alperrte", "project-delivery-assistant", "main", 1))
                .thenReturn(List.of(commit("tip0000000000000000000000000000000000000", "Tip")));

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

        // Connecting starts tracking from the branch tip, so history before the connect is never announced.
        assertEquals("tip0000000000000000000000000000000000000",
                connections.findByProjectId(projectId).orElseThrow().getNotifiedHeadSha());

        Mockito.when(gitHub.fetchCommits("alperrte", "project-delivery-assistant", "main", null, 1, 10))
                .thenReturn(List.of(new CommitSummary("abcdef1234567890", "abcdef1", "Fix bug", "Alper", "alperrte",
                        null, Instant.parse("2026-09-27T10:00:00Z"), "https://github.com/a/b/commit/abcdef1")));
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository/commits").cookie(contributor.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sha").value("abcdef1234567890"))
                .andExpect(jsonPath("$[0].shortSha").value("abcdef1"))
                .andExpect(jsonPath("$[0].authorLogin").value("alperrte"))
                .andExpect(jsonPath("$[0].message").value("Fix bug"));

        // GitHub failing does not take down the rest of the API: it surfaces as its own safe status.
        Mockito.when(gitHub.fetchCommits("alperrte", "project-delivery-assistant", "main", null, 1, 10))
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
    void membersReadBranchesCompareAndFilteredCommits() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("repobranchmgr");
        Account contributor = account("repobranchmember");
        UUID projectId = connectedProject(manager, csrf, "Repo branches project", "branchowner", "branchrepo");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));

        Mockito.when(gitHub.fetchBranches("branchowner", "branchrepo")).thenReturn(new BranchPage(List.of(
                new BranchSummary("feature/login", "1234567890abcdef", false),
                new BranchSummary("main", "fedcba0987654321", true),
                new BranchSummary("develop", "0000000aaaaaaaa", false)), false));

        // Default branch first, then alphabetical; never anything that is not a branch of the repository.
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository/branches").cookie(contributor.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.branches[0].name").value("main"))
                .andExpect(jsonPath("$.branches[0].isDefault").value(true))
                .andExpect(jsonPath("$.branches[0].isProtected").value(true))
                .andExpect(jsonPath("$.branches[0].headShortSha").value("fedcba0"))
                .andExpect(jsonPath("$.branches[1].name").value("develop"))
                .andExpect(jsonPath("$.branches[2].name").value("feature/login"))
                .andExpect(jsonPath("$.truncated").value(false));

        Mockito.when(gitHub.compare("branchowner", "branchrepo", "main", "feature/login"))
                .thenReturn(new BranchComparison(2, 1, List.of(commit("c2", "Second"), commit("c1", "First")), false));
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository/compare").param("branch", "feature/login")
                        .cookie(contributor.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.base").value("main"))
                .andExpect(jsonPath("$.branch").value("feature/login"))
                .andExpect(jsonPath("$.aheadBy").value(2))
                .andExpect(jsonPath("$.behindBy").value(1))
                .andExpect(jsonPath("$.unmergedCommits[0].message").value("Second"))
                .andExpect(jsonPath("$.truncated").value(false));
        // The default branch has nothing left to merge, without a GitHub call.
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository/compare").cookie(contributor.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aheadBy").value(0))
                .andExpect(jsonPath("$.unmergedCommits").isEmpty());
        Mockito.verify(gitHub, Mockito.never()).compare("branchowner", "branchrepo", "main", "main");

        Mockito.when(gitHub.fetchCommits("branchowner", "branchrepo", "feature/login", "octocat", 2, 5))
                .thenReturn(List.of(commit("c3", "Filtered")));
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository/commits")
                        .param("branch", "feature/login").param("author", "octocat")
                        .param("page", "2").param("limit", "5").cookie(contributor.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].message").value("Filtered"));
    }

    @Test
    void branchAndAuthorInputsAreValidatedBeforeAnyGitHubCall() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("repovalidmgr");
        UUID projectId = connectedProject(manager, csrf, "Repo validation project", "validowner", "validrepo");
        Mockito.when(gitHub.fetchBranches("validowner", "validrepo")).thenReturn(new BranchPage(
                List.of(new BranchSummary("main", "abc", false)), false));
        String commits = "/api/v1/projects/" + projectId + "/repository/commits";

        // Not a valid git ref -> 400; a valid ref that is not a branch of the repository -> 404.
        mvc.perform(get(commits).param("branch", "a..b").cookie(manager.access()))
                .andExpect(status().isBadRequest());
        mvc.perform(get(commits).param("branch", "has space").cookie(manager.access()))
                .andExpect(status().isBadRequest());
        mvc.perform(get(commits).param("branch", "ghost").cookie(manager.access()))
                .andExpect(status().isNotFound());
        mvc.perform(get(commits).param("author", "not a login!").cookie(manager.access()))
                .andExpect(status().isBadRequest());
        mvc.perform(get(commits).param("page", "0").cookie(manager.access())).andExpect(status().isBadRequest());
        mvc.perform(get(commits).param("page", "11").cookie(manager.access())).andExpect(status().isBadRequest());
        Mockito.verify(gitHub, Mockito.never()).fetchCommits(Mockito.anyString(), Mockito.anyString(),
                Mockito.eq("ghost"), Mockito.any(), Mockito.anyInt(), Mockito.anyInt());
    }

    @Test
    void newReadEndpointsRequireAnActiveProjectMemberAndAuthentication() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("reporeadmgr");
        Account outsider = account("reporeadoutsider");
        UUID projectId = connectedProject(manager, csrf, "Repo read access project", "accessowner", "accessrepo");

        for (String path : List.of("/branches", "/compare", "/commits")) {
            mvc.perform(get("/api/v1/projects/" + projectId + "/repository" + path).cookie(outsider.access()))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/projects/" + projectId + "/repository" + path))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void connectRejectsPrivateRepositories() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("repoprivatemgr");
        UUID projectId = createProject(manager, csrf, "Repo private project");
        Mockito.when(gitHub.fetchMetadata("owner", "secret")).thenReturn(new RepositoryMetadata("main", true));

        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://github.com/owner/secret\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REPOSITORY_PRIVATE"));
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository").cookie(manager.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void repositoryReadsArePerUserLimitedWithRetryAfter() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("repolimitmgr");
        UUID projectId = connectedProject(manager, csrf, "Repo limit project", "limitowner", "limitrepo");
        Mockito.when(gitHub.fetchCommits("limitowner", "limitrepo", "main", null, 1, 10)).thenReturn(List.of());

        for (int i = 0; i < READ_LIMIT; i++) {
            mvc.perform(get("/api/v1/projects/" + projectId + "/repository/commits").cookie(manager.access()))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository/commits").cookie(manager.access()))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andExpect(jsonPath("$.code").value("REPOSITORY_READ_LIMIT"));
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

    @Test
    void connectSurfacesGitHubServerErrorAsSafeUnavailableWithoutLeakingDetails() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("repomanager4");
        UUID projectId = createProject(manager, csrf, "Repo unavailable project");
        Mockito.when(gitHub.fetchMetadata("owner", "flaky"))
                .thenThrow(new GitHubIntegrationException(Reason.UNAVAILABLE, "GitHub is currently unavailable"));

        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://github.com/owner/flaky\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.detail").value("GitHub is currently unavailable"))
                .andExpect(jsonPath("$.detail", org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsStringIgnoringCase("stack"))));
    }

    @Test
    void everyContributorRoleIsDeniedEveryRepositoryMutation() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("repomanager3");
        UUID projectId = createProject(manager, csrf, "Repository role matrix project");

        for (ProjectRole role : ProjectRole.values()) {
            if (role == ProjectRole.PROJECT_MANAGER) {
                continue;
            }
            Account holder = account("repotolerole" + role.name().toLowerCase());
            memberships.addMember(manager.id(), projectId, holder.id(), Set.of(role));

            mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"repositoryUrl\":\"https://github.com/alperrte/project-delivery-assistant\"}"))
                    .andExpect(status().isForbidden());
            mvc.perform(delete("/api/v1/projects/" + projectId + "/repository")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden());
        }

        // Authenticated but not a member of this project at all.
        Account outsider = account("repooutsider3");
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository").cookie(outsider.access()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects/" + projectId + "/repository/commits").cookie(outsider.access()))
                .andExpect(status().isForbidden());
    }

    private UUID connectedProject(Account manager, Cookie csrf, String name, String owner, String repository)
            throws Exception {
        UUID projectId = createProject(manager, csrf, name);
        Mockito.when(gitHub.fetchMetadata(owner, repository)).thenReturn(new RepositoryMetadata("main", false));
        mvc.perform(post("/api/v1/projects/" + projectId + "/repository")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://github.com/" + owner + "/" + repository + "\"}"))
                .andExpect(status().isCreated());
        return projectId;
    }

    private static CommitSummary commit(String sha, String message) {
        return new CommitSummary(sha, sha.length() > 7 ? sha.substring(0, 7) : sha, message, "Alper", "alperrte",
                null, Instant.parse("2026-09-27T10:00:00Z"), "https://github.com/a/b/commit/" + sha);
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
