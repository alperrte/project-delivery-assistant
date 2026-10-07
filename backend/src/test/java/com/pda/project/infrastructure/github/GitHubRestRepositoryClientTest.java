package com.pda.project.infrastructure.github;

import com.pda.project.application.service.GitHubIntegrationException;
import com.pda.project.application.service.GitHubIntegrationException.Reason;
import com.pda.project.application.service.GitHubRepositoryClient.BranchComparison;
import com.pda.project.application.service.GitHubRepositoryClient.BranchPage;
import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;
import com.pda.project.application.service.GitHubRepositoryClient.RepositoryMetadata;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GitHubRestRepositoryClientTest {

    private RestClient.Builder builder;
    private MockRestServiceServer server;
    private GitHubRestRepositoryClient client;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder().baseUrl("https://api.github.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new GitHubRestRepositoryClient(builder.build());
    }

    @Test
    void fetchMetadataReturnsDefaultBranch() {
        server.expect(requestTo("https://api.github.com/repos/owner/repo"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"default_branch\":\"main\",\"private\":false}", MediaType.APPLICATION_JSON));

        RepositoryMetadata metadata = client.fetchMetadata("owner", "repo");

        assertEquals("main", metadata.defaultBranch());
    }

    @Test
    void fetchMetadataMapsNotFoundToNotFoundReason() {
        server.expect(requestTo("https://api.github.com/repos/owner/missing"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        GitHubIntegrationException exception = assertThrows(GitHubIntegrationException.class,
                () -> client.fetchMetadata("owner", "missing"));
        assertEquals(Reason.NOT_FOUND, exception.getReason());
    }

    @Test
    void fetchMetadataMapsForbiddenAndTooManyRequestsToRateLimited() {
        server.expect(requestTo("https://api.github.com/repos/owner/limited"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN));

        GitHubIntegrationException exception = assertThrows(GitHubIntegrationException.class,
                () -> client.fetchMetadata("owner", "limited"));
        assertEquals(Reason.RATE_LIMITED, exception.getReason());
    }

    @Test
    void fetchMetadataMapsServerErrorToUnavailableWithoutLeakingDetails() {
        server.expect(requestTo("https://api.github.com/repos/owner/broken"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body("{\"message\":\"internal secret stack trace\"}"));

        GitHubIntegrationException exception = assertThrows(GitHubIntegrationException.class,
                () -> client.fetchMetadata("owner", "broken"));
        assertEquals(Reason.UNAVAILABLE, exception.getReason());
        assertTrue(exception.getMessage() != null && !exception.getMessage().contains("secret"));
    }

    @Test
    void fetchLatestCommitsMapsGitHubShapeToSafeSummaries() {
        String body = """
                [
                  {
                    "sha": "abcdef1234567890",
                    "commit": {
                      "message": "Fix login bug\\n\\nLonger body text here.",
                      "author": { "name": "Alper", "date": "2026-09-27T10:15:30Z" }
                    },
                    "html_url": "https://github.com/owner/repo/commit/abcdef1234567890",
                    "author": { "login": "alperrte", "avatar_url": "https://avatars.githubusercontent.com/u/1" }
                  },
                  {
                    "sha": "1111111",
                    "commit": {
                      "message": "No GitHub account commit",
                      "author": { "name": "Someone", "date": "2026-09-26T08:00:00Z" }
                    },
                    "html_url": "https://github.com/owner/repo/commit/1111111",
                    "author": null
                  }
                ]
                """;
        server.expect(requestTo("https://api.github.com/repos/owner/repo/commits?sha=main&per_page=10"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        List<CommitSummary> commits = client.fetchLatestCommits("owner", "repo", "main", 10);

        assertEquals(2, commits.size());
        assertEquals("abcdef1", commits.get(0).shortSha());
        assertEquals("Fix login bug", commits.get(0).message());
        assertEquals("Alper", commits.get(0).author());
        assertEquals("https://avatars.githubusercontent.com/u/1", commits.get(0).authorAvatarUrl());
        assertEquals(Instant.parse("2026-09-27T10:15:30Z"), commits.get(0).committedAt());
        assertEquals("https://github.com/owner/repo/commit/abcdef1234567890", commits.get(0).commitUrl());

        assertEquals("1111111", commits.get(1).shortSha());
        assertNull(commits.get(1).authorAvatarUrl());
    }

    @Test
    void fetchMetadataReportsPrivateRepositories() {
        server.expect(requestTo("https://api.github.com/repos/owner/secret"))
                .andRespond(withSuccess("{\"default_branch\":\"main\",\"private\":true}", MediaType.APPLICATION_JSON));

        assertTrue(client.fetchMetadata("owner", "secret").isPrivate());
    }

    @Test
    void fetchBranchesMapsNamesShasAndProtection() {
        String body = """
                [
                  {"name": "main", "protected": true, "commit": {"sha": "aaaaaaa1111111"}},
                  {"name": "feature/login", "protected": false, "commit": {"sha": "bbbbbbb2222222"}},
                  {"protected": false}
                ]
                """;
        server.expect(requestTo("https://api.github.com/repos/owner/repo/branches?per_page=100"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        BranchPage page = client.fetchBranches("owner", "repo");

        assertEquals(2, page.branches().size());
        assertEquals("main", page.branches().get(0).name());
        assertTrue(page.branches().get(0).isProtected());
        assertEquals("bbbbbbb2222222", page.branches().get(1).headSha());
        assertFalse(page.truncated());
    }

    @Test
    void fetchBranchesIsTruncatedWhenGitHubReturnsAFullPage() {
        StringBuilder body = new StringBuilder("[");
        for (int i = 0; i < 100; i++) {
            body.append(i == 0 ? "" : ",").append("{\"name\":\"b").append(i)
                    .append("\",\"protected\":false,\"commit\":{\"sha\":\"abc\"}}");
        }
        server.expect(requestTo("https://api.github.com/repos/owner/repo/branches?per_page=100"))
                .andRespond(withSuccess(body.append("]").toString(), MediaType.APPLICATION_JSON));

        BranchPage page = client.fetchBranches("owner", "repo");

        assertEquals(100, page.branches().size());
        assertTrue(page.truncated());
    }

    @Test
    void fetchCommitsPagesAndFiltersByAuthorWithEncodedValues() {
        String body = """
                [{"sha": "abcdef1234567890", "commit": {"message": "Work", "author": {"name": "Octo",
                  "date": "2026-09-27T10:15:30Z"}}, "html_url": "https://github.com/owner/repo/commit/abcdef1234567890",
                  "author": {"login": "octocat", "avatar_url": "https://avatars.githubusercontent.com/u/9"}}]
                """;
        server.expect(requestTo("https://api.github.com/repos/owner/repo/commits"
                        + "?sha=feature%2Flogin&author=octocat&per_page=5&page=2"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        List<CommitSummary> commits = client.fetchCommits("owner", "repo", "feature/login", "octocat", 2, 5);

        assertEquals(1, commits.size());
        assertEquals("abcdef1234567890", commits.get(0).sha());
        assertEquals("octocat", commits.get(0).authorLogin());
    }

    @Test
    void fetchCommitsWithoutAuthorOmitsTheAuthorFilter() {
        server.expect(requestTo("https://api.github.com/repos/owner/repo/commits?sha=main&per_page=10&page=1"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        assertTrue(client.fetchCommits("owner", "repo", "main", null, 1, 10).isEmpty());
    }

    @Test
    void compareMapsAheadBehindAndListsUnmergedCommitsNewestFirst() {
        String body = """
                {"ahead_by": 2, "behind_by": 3, "commits": [
                  {"sha": "1111111aaaa", "commit": {"message": "First", "author": {"name": "A", "date": "2026-09-26T08:00:00Z"}},
                   "html_url": "https://github.com/owner/repo/commit/1111111aaaa", "author": null},
                  {"sha": "2222222bbbb", "commit": {"message": "Second", "author": {"name": "A", "date": "2026-09-27T08:00:00Z"}},
                   "html_url": "https://github.com/owner/repo/commit/2222222bbbb", "author": null}
                ]}
                """;
        server.expect(requestTo("https://api.github.com/repos/owner/repo/compare/main...feature%2Flogin?per_page=100"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        BranchComparison comparison = client.compare("owner", "repo", "main", "feature/login");

        assertEquals(2, comparison.aheadBy());
        assertEquals(3, comparison.behindBy());
        assertEquals("Second", comparison.aheadCommits().get(0).message());
        assertEquals("First", comparison.aheadCommits().get(1).message());
        assertFalse(comparison.truncated());
    }

    @Test
    void compareIsTruncatedWhenGitHubHasMoreCommitsThanItReturned() {
        String body = """
                {"ahead_by": 250, "behind_by": 0, "commits": [
                  {"sha": "1111111aaaa", "commit": {"message": "Only one", "author": {"name": "A", "date": "2026-09-26T08:00:00Z"}},
                   "html_url": "https://github.com/owner/repo/commit/1111111aaaa", "author": null}
                ]}
                """;
        server.expect(requestTo("https://api.github.com/repos/owner/repo/compare/main...big?per_page=100"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertTrue(client.compare("owner", "repo", "main", "big").truncated());
    }

    @Test
    void tokenIsSentAsBearerOnlyWhenConfigured() {
        RestClient.Builder withToken = RestClient.builder().baseUrl("https://api.github.com");
        MockRestServiceServer tokenServer = MockRestServiceServer.bindTo(withToken).build();
        GitHubRestRepositoryClient authorized = new GitHubRestRepositoryClient(
                GitHubRestRepositoryClient.authorized(withToken, "  ghp_secret  "));
        tokenServer.expect(requestTo("https://api.github.com/repos/owner/repo"))
                .andExpect(header("Authorization", "Bearer ghp_secret"))
                .andRespond(withSuccess("{\"default_branch\":\"main\"}", MediaType.APPLICATION_JSON));
        authorized.fetchMetadata("owner", "repo");
        tokenServer.verify();

        RestClient.Builder anonymousBuilder = RestClient.builder().baseUrl("https://api.github.com");
        MockRestServiceServer anonymousServer = MockRestServiceServer.bindTo(anonymousBuilder).build();
        GitHubRestRepositoryClient anonymous = new GitHubRestRepositoryClient(
                GitHubRestRepositoryClient.authorized(anonymousBuilder, "   "));
        anonymousServer.expect(requestTo("https://api.github.com/repos/owner/repo"))
                .andExpect(headerDoesNotExist("Authorization"))
                .andRespond(withSuccess("{\"default_branch\":\"main\"}", MediaType.APPLICATION_JSON));
        anonymous.fetchMetadata("owner", "repo");
        anonymousServer.verify();
    }

    @Test
    void tokenNeverAppearsInErrorMessages() {
        RestClient.Builder withToken = RestClient.builder().baseUrl("https://api.github.com");
        MockRestServiceServer tokenServer = MockRestServiceServer.bindTo(withToken).build();
        GitHubRestRepositoryClient authorized = new GitHubRestRepositoryClient(
                GitHubRestRepositoryClient.authorized(withToken, "ghp_secret"));
        tokenServer.expect(requestTo("https://api.github.com/repos/owner/repo"))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY));

        GitHubIntegrationException exception = assertThrows(GitHubIntegrationException.class,
                () -> authorized.fetchMetadata("owner", "repo"));

        assertFalse(String.valueOf(exception.getMessage()).contains("ghp_secret"));
    }

    @Test
    void fetchLatestCommitsMapsNotFound() {
        server.expect(requestTo("https://api.github.com/repos/owner/repo/commits?sha=missing-branch&per_page=5"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        GitHubIntegrationException exception = assertThrows(GitHubIntegrationException.class,
                () -> client.fetchLatestCommits("owner", "repo", "missing-branch", 5));
        assertEquals(Reason.NOT_FOUND, exception.getReason());
    }
}
