package com.pda.project.application.service;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SSRF-safe public GitHub repository URL validation (HMZ-PROJ-27). This never fetches the caller-supplied URL:
 * it only parses it with {@link URI} (no network I/O) and extracts {@code owner}/{@code repository} through a
 * strict allowlist regex. The backend then builds its own canonical {@code api.github.com} URLs from those two
 * validated strings, so a malicious/malformed URL can never reach an outbound request.
 */
public final class GitHubRepositoryUrlParser {

    private static final String ALLOWED_HOST = "github.com";
    // GitHub usernames/orgs: alphanumeric, single hyphens, not leading/trailing. Repo names: alphanumeric, '.', '_', '-'.
    private static final Pattern OWNER_REPO_PATH = Pattern.compile(
            "^/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)/([A-Za-z0-9_.-]{1,100}?)(?:\\.git)?/?$");

    private GitHubRepositoryUrlParser() {
    }

    public record ParsedRepository(String owner, String repository, String canonicalUrl) {
    }

    public static ParsedRepository parse(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalArgumentException("repositoryUrl is required");
        }
        URI uri;
        try {
            uri = new URI(rawUrl.strip());
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("repositoryUrl is not a valid URL");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalArgumentException("repositoryUrl must use http or https");
        }
        if (!ALLOWED_HOST.equalsIgnoreCase(uri.getHost())) {
            throw new IllegalArgumentException("Only github.com repository URLs are supported");
        }
        if (uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443 && uri.getPort() != 80)
                || uri.getRawQuery() != null || uri.getRawFragment() != null) {
            throw new IllegalArgumentException("repositoryUrl is not a valid GitHub repository URL");
        }
        String path = uri.getRawPath() == null ? "" : uri.getRawPath();
        Matcher matcher = OWNER_REPO_PATH.matcher(path);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("repositoryUrl must look like https://github.com/{owner}/{repo}");
        }
        String owner = matcher.group(1);
        String repository = matcher.group(2);
        return new ParsedRepository(owner, repository, "https://github.com/" + owner + "/" + repository);
    }
}
