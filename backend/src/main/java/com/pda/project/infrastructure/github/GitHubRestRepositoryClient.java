package com.pda.project.infrastructure.github;

import com.pda.project.application.service.GitHubIntegrationException;
import com.pda.project.application.service.GitHubIntegrationException.Reason;
import com.pda.project.application.service.GitHubRepositoryClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.HttpClientErrorException;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Calls only {@code api.github.com} with URLs this class builds itself from already-validated owner/repository
 * strings (see {@link com.pda.project.application.service.GitHubRepositoryUrlParser}); it never fetches a
 * caller-supplied URL. Public repositories only. An optional server-side token ({@code pda.github.api-token},
 * empty by default) only raises GitHub's rate limit from 60 to 5000 requests per hour; it is never logged, put in
 * an error message or returned to a client.
 */
@Component
public class GitHubRestRepositoryClient implements GitHubRepositoryClient {

    private static final Logger log = LoggerFactory.getLogger(GitHubRestRepositoryClient.class);
    private static final int TIMEOUT_MILLIS = 5000;
    static final int BRANCH_PAGE_SIZE = 100;
    static final int COMPARE_PAGE_SIZE = 100;

    /** The {@code rel} parameter of one Link entry: quoted ({@code rel="next"}) or bare ({@code rel=next}). */
    private static final Pattern LINK_REL = Pattern.compile(
            ";\\s*rel\\s*=\\s*(?:\"([^\"]*)\"|([^\\s;,]+))", Pattern.CASE_INSENSITIVE);

    private final RestClient http;

    @Autowired
    public GitHubRestRepositoryClient(@Value("${pda.github.api-token:}") String apiToken) {
        this(authorized(defaultBuilder(), apiToken));
    }

    /** Visible for testing: lets a test bind {@code http} to a {@code MockRestServiceServer} instead. */
    GitHubRestRepositoryClient(RestClient http) {
        this.http = http;
    }

    private static RestClient.Builder defaultBuilder() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(TIMEOUT_MILLIS);
        factory.setReadTimeout(TIMEOUT_MILLIS);
        return RestClient.builder()
                .baseUrl("https://api.github.com")
                .requestFactory(factory)
                .defaultHeader("Accept", "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28");
    }

    /** Adds the bearer header only when a token is configured; a blank token keeps requests anonymous. */
    static RestClient authorized(RestClient.Builder builder, String apiToken) {
        if (apiToken != null && !apiToken.isBlank()) {
            builder.defaultHeader("Authorization", "Bearer " + apiToken.trim());
        }
        return builder.build();
    }

    @Override
    public RepositoryMetadata fetchMetadata(String owner, String repository) {
        return call("GitHub repository not found", "metadata", () -> {
            Map<String, Object> body = http.get()
                    .uri("/repos/{owner}/{repo}", owner, repository)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            Object defaultBranch = body == null ? null : body.get("default_branch");
            if (!(defaultBranch instanceof String branch) || branch.isBlank()) {
                throw new GitHubIntegrationException(Reason.UNAVAILABLE, "GitHub repository metadata is incomplete");
            }
            return new RepositoryMetadata(branch, Boolean.TRUE.equals(body.get("private")));
        });
    }

    @Override
    public List<CommitSummary> fetchLatestCommits(String owner, String repository, String branch, int limit) {
        return call("GitHub repository or branch not found", "commits", () -> toCommits(http.get()
                .uri("/repos/{owner}/{repo}/commits?sha={branch}&per_page={limit}", owner, repository, branch, limit)
                .retrieve()
                .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {})));
    }

    @Override
    public CommitPage fetchCommits(String owner, String repository, String branch, String author, int page,
                                   int perPage) {
        return call("GitHub repository or branch not found", "commits", () -> {
            ResponseEntity<List<Map<String, Object>>> response = author == null || author.isBlank()
                    ? http.get()
                            .uri("/repos/{owner}/{repo}/commits?sha={branch}&per_page={perPage}&page={page}", owner,
                                    repository, branch, perPage, page)
                            .retrieve().toEntity(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                    : http.get()
                            .uri("/repos/{owner}/{repo}/commits?sha={branch}&author={author}&per_page={perPage}&page={page}",
                                    owner, repository, branch, author, perPage, page)
                            .retrieve().toEntity(new ParameterizedTypeReference<List<Map<String, Object>>>() {});
            return new CommitPage(toCommits(response.getBody()),
                    hasNextPage(response.getHeaders().get(HttpHeaders.LINK)));
        });
    }

    /**
     * True when any {@code Link} header value carries an entry whose {@code rel} includes {@code next}, e.g.
     * {@code <https://api.github.com/...&page=3>; rel="next", <...>; rel="last"}. A missing or malformed header
     * simply means "no next page".
     */
    static boolean hasNextPage(List<String> linkHeaderValues) {
        if (linkHeaderValues == null) {
            return false;
        }
        for (String value : linkHeaderValues) {
            if (value == null) {
                continue;
            }
            Matcher matcher = LINK_REL.matcher(value);
            while (matcher.find()) {
                String rel = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
                for (String token : rel.trim().split("\\s+")) {
                    if (token.equalsIgnoreCase("next")) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    @Override
    @SuppressWarnings("unchecked")
    public BranchPage fetchBranches(String owner, String repository) {
        return call("GitHub repository not found", "branches", () -> {
            List<Map<String, Object>> body = http.get()
                    .uri("/repos/{owner}/{repo}/branches?per_page={perPage}", owner, repository, BRANCH_PAGE_SIZE)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {});
            if (body == null) {
                return new BranchPage(List.of(), false);
            }
            List<BranchSummary> branches = new ArrayList<>();
            for (Map<String, Object> entry : body) {
                if (!(entry != null && entry.get("name") instanceof String name) || name.isBlank()) {
                    continue;
                }
                String sha = entry.get("commit") instanceof Map<?, ?> commit
                        ? asString(((Map<String, Object>) commit).get("sha")) : null;
                branches.add(new BranchSummary(name, sha == null ? "" : sha, Boolean.TRUE.equals(entry.get("protected"))));
            }
            return new BranchPage(List.copyOf(branches), body.size() >= BRANCH_PAGE_SIZE);
        });
    }

    @Override
    public BranchComparison compare(String owner, String repository, String base, String head) {
        return call("GitHub repository or branch not found", "compare", () -> {
            Map<String, Object> body = http.get()
                    .uri("/repos/{owner}/{repo}/compare/{base}...{head}?per_page={perPage}", owner, repository, base,
                            head, COMPARE_PAGE_SIZE)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            if (body == null) {
                return new BranchComparison(0, 0, List.of(), false);
            }
            int ahead = asInt(body.get("ahead_by"));
            int behind = asInt(body.get("behind_by"));
            @SuppressWarnings("unchecked")
            List<CommitSummary> commits = new ArrayList<>(toCommits(body.get("commits") instanceof List<?> list
                    ? (List<Map<String, Object>>) list : null));
            // GitHub lists compared commits oldest first; the UI shows newest first.
            Collections.reverse(commits);
            return new BranchComparison(ahead, behind, List.copyOf(commits), ahead > commits.size());
        });
    }

    private <T> T call(String notFoundMessage, String what, Supplier<T> request) {
        try {
            return request.get();
        } catch (GitHubIntegrationException exception) {
            throw exception;
        } catch (HttpClientErrorException.NotFound exception) {
            throw new GitHubIntegrationException(Reason.NOT_FOUND, notFoundMessage);
        } catch (HttpClientErrorException.Forbidden | HttpClientErrorException.TooManyRequests exception) {
            throw new GitHubIntegrationException(Reason.RATE_LIMITED, "GitHub rate limit reached");
        } catch (RestClientException exception) {
            log.warn("GitHub {} fetch failed: {}", what, exception.getClass().getSimpleName());
            throw new GitHubIntegrationException(Reason.UNAVAILABLE, "GitHub is currently unavailable");
        }
    }

    private static List<CommitSummary> toCommits(List<Map<String, Object>> commits) {
        if (commits == null) {
            return List.of();
        }
        return commits.stream().map(GitHubRestRepositoryClient::toCommitSummary)
                .filter(Objects::nonNull).toList();
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
        String authorLogin = null;
        Object githubAuthor = entry.get("author");
        if (githubAuthor instanceof Map<?, ?> ghAuthor) {
            avatarUrl = asString(((Map<String, Object>) ghAuthor).get("avatar_url"));
            authorLogin = asString(((Map<String, Object>) ghAuthor).get("login"));
        }
        String shortSha = sha.length() > 7 ? sha.substring(0, 7) : sha;
        return new CommitSummary(sha, shortSha, message, authorName, authorLogin, avatarUrl, committedAt, commitUrl);
    }

    private static String asString(Object value) {
        return value instanceof String text ? text : null;
    }

    private static int asInt(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
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
