package com.pda.project.infrastructure.github;

import com.pda.project.application.service.GitHubIntegrationException;
import com.pda.project.application.service.GitHubIntegrationException.Reason;
import com.pda.project.application.service.GitHubRepositoryClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.HttpClientErrorException;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Calls only {@code api.github.com} with URLs this class builds itself from already-validated owner/repository
 * strings (see {@link com.pda.project.application.service.GitHubRepositoryUrlParser}); it never fetches a
 * caller-supplied URL. Unauthenticated (public repositories only, V1), so no token/secret is needed.
 */
@Component
public class GitHubRestRepositoryClient implements GitHubRepositoryClient {

    private static final Logger log = LoggerFactory.getLogger(GitHubRestRepositoryClient.class);
    private static final int TIMEOUT_MILLIS = 5000;

    private final RestClient http;

    public GitHubRestRepositoryClient() {
        this(defaultClient());
    }

    /** Visible for testing: lets a test bind {@code http} to a {@code MockRestServiceServer} instead. */
    GitHubRestRepositoryClient(RestClient http) {
        this.http = http;
    }

    private static RestClient defaultClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(TIMEOUT_MILLIS);
        factory.setReadTimeout(TIMEOUT_MILLIS);
        return RestClient.builder()
                .baseUrl("https://api.github.com")
                .requestFactory(factory)
                .defaultHeader("Accept", "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
                .build();
    }

    @Override
    public RepositoryMetadata fetchMetadata(String owner, String repository) {
        try {
            Map<String, Object> body = http.get()
                    .uri("/repos/{owner}/{repo}", owner, repository)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            Object defaultBranch = body == null ? null : body.get("default_branch");
            if (!(defaultBranch instanceof String branch) || branch.isBlank()) {
                throw new GitHubIntegrationException(Reason.UNAVAILABLE, "GitHub repository metadata is incomplete");
            }
            return new RepositoryMetadata(branch);
        } catch (HttpClientErrorException.NotFound exception) {
            throw new GitHubIntegrationException(Reason.NOT_FOUND, "GitHub repository not found");
        } catch (HttpClientErrorException.Forbidden | HttpClientErrorException.TooManyRequests exception) {
            throw new GitHubIntegrationException(Reason.RATE_LIMITED, "GitHub rate limit reached");
        } catch (RestClientException exception) {
            log.warn("GitHub metadata fetch failed: {}", exception.getClass().getSimpleName());
            throw new GitHubIntegrationException(Reason.UNAVAILABLE, "GitHub is currently unavailable");
        }
    }

    @Override
    public List<CommitSummary> fetchLatestCommits(String owner, String repository, String branch, int limit) {
        try {
            List<Map<String, Object>> commits = http.get()
                    .uri("/repos/{owner}/{repo}/commits?sha={branch}&per_page={limit}", owner, repository, branch,
                            limit)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {});
            if (commits == null) {
                return List.of();
            }
            return commits.stream().map(GitHubRestRepositoryClient::toCommitSummary)
                    .filter(Objects::nonNull).toList();
        } catch (HttpClientErrorException.NotFound exception) {
            throw new GitHubIntegrationException(Reason.NOT_FOUND, "GitHub repository or branch not found");
        } catch (HttpClientErrorException.Forbidden | HttpClientErrorException.TooManyRequests exception) {
            throw new GitHubIntegrationException(Reason.RATE_LIMITED, "GitHub rate limit reached");
        } catch (RestClientException exception) {
            log.warn("GitHub commits fetch failed: {}", exception.getClass().getSimpleName());
            throw new GitHubIntegrationException(Reason.UNAVAILABLE, "GitHub is currently unavailable");
        }
    }

    @SuppressWarnings("unchecked")
    static CommitSummary toCommitSummary(Map<String, Object> entry) {
        if (entry == null) {
            return null;
        }
        Object shaValue = entry.get("sha");
        Object commitValue = entry.get("commit");
        Object htmlUrlValue = entry.get("html_url");
        if (!(shaValue instanceof String sha) || sha.isBlank() || !(commitValue instanceof Map<?, ?> commit)
                || !(htmlUrlValue instanceof String commitUrl)) {
            return null;
        }
        Map<String, Object> commitMap = (Map<String, Object>) commit;
        String message = firstLine(asString(commitMap.get("message")));
        Object authorValue = commitMap.get("author");
        String authorName = null;
        Instant committedAt = null;
        if (authorValue instanceof Map<?, ?> author) {
            Map<String, Object> authorMap = (Map<String, Object>) author;
            authorName = asString(authorMap.get("name"));
            committedAt = parseInstant(asString(authorMap.get("date")));
        }
        String avatarUrl = null;
        Object githubAuthor = entry.get("author");
        if (githubAuthor instanceof Map<?, ?> ghAuthor) {
            avatarUrl = asString(((Map<String, Object>) ghAuthor).get("avatar_url"));
        }
        String shortSha = sha.length() > 7 ? sha.substring(0, 7) : sha;
        return new CommitSummary(shortSha, message, authorName, avatarUrl, committedAt, commitUrl);
    }

    private static String asString(Object value) {
        return value instanceof String text ? text : null;
    }

    private static String firstLine(String message) {
        if (message == null) {
            return null;
        }
        int newline = message.indexOf('\n');
        return (newline >= 0 ? message.substring(0, newline) : message).strip();
    }

    private static Instant parseInstant(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException exception) {
            return null;
        }
    }
}
