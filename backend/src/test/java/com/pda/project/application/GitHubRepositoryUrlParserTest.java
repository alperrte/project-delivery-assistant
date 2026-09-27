package com.pda.project.application;

import com.pda.project.application.service.GitHubRepositoryUrlParser;
import com.pda.project.application.service.GitHubRepositoryUrlParser.ParsedRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class GitHubRepositoryUrlParserTest {

    @Test
    void parsesOwnerAndRepositoryFromACanonicalUrl() {
        ParsedRepository parsed = GitHubRepositoryUrlParser.parse("https://github.com/alperrte/project-delivery-assistant");
        assertEquals("alperrte", parsed.owner());
        assertEquals("project-delivery-assistant", parsed.repository());
        assertEquals("https://github.com/alperrte/project-delivery-assistant", parsed.canonicalUrl());
    }

    @Test
    void acceptsTrailingSlashGitSuffixAndHttp() {
        assertEquals("repo", GitHubRepositoryUrlParser.parse("https://github.com/owner/repo/").repository());
        assertEquals("repo", GitHubRepositoryUrlParser.parse("https://github.com/owner/repo.git").repository());
        assertEquals("owner", GitHubRepositoryUrlParser.parse("http://github.com/owner/repo").owner());
    }

    @Test
    void rejectsNonGitHubHosts() {
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://evil.com/owner/repo"));
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://github.com.evil.com/owner/repo"));
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://raw.githubusercontent.com/owner/repo"));
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://api.github.com/repos/owner/repo"));
    }

    @Test
    void rejectsMalformedOrSuspiciousUrls() {
        assertThrows(IllegalArgumentException.class, () -> GitHubRepositoryUrlParser.parse(null));
        assertThrows(IllegalArgumentException.class, () -> GitHubRepositoryUrlParser.parse(" "));
        assertThrows(IllegalArgumentException.class, () -> GitHubRepositoryUrlParser.parse("not a url"));
        assertThrows(IllegalArgumentException.class, () -> GitHubRepositoryUrlParser.parse("ftp://github.com/owner/repo"));
        assertThrows(IllegalArgumentException.class, () -> GitHubRepositoryUrlParser.parse("https://github.com/owner"));
        assertThrows(IllegalArgumentException.class, () -> GitHubRepositoryUrlParser.parse("https://github.com/owner/repo/extra"));
        assertThrows(IllegalArgumentException.class, () -> GitHubRepositoryUrlParser.parse("https://github.com/"));
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://user:pass@github.com/owner/repo"));
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://github.com:8443/owner/repo"));
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://github.com/owner/repo?x=1"));
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://github.com/owner/repo#section"));
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://github.com/-owner/repo"));
        assertThrows(IllegalArgumentException.class,
                () -> GitHubRepositoryUrlParser.parse("https://github.com/owner/../../etc/passwd"));
    }
}
