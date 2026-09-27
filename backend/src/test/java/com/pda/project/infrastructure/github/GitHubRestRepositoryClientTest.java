package com.pda.project.infrastructure.github;

import com.pda.project.application.service.GitHubIntegrationException;
import com.pda.project.application.service.GitHubIntegrationException.Reason;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
    void fetchLatestCommitsMapsNotFound() {
        server.expect(requestTo("https://api.github.com/repos/owner/repo/commits?sha=missing-branch&per_page=5"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        GitHubIntegrationException exception = assertThrows(GitHubIntegrationException.class,
                () -> client.fetchLatestCommits("owner", "repo", "missing-branch", 5));
        assertEquals(Reason.NOT_FOUND, exception.getReason());
    }
}
