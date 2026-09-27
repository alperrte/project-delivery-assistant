package com.pda.auth.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GitHubOAuth2UserServiceTest {

    @Test
    void picksOnlyThePrimaryVerifiedEmail() {
        List<Map<String, Object>> emails = List.of(
                Map.of("email", "old@example.com", "primary", false, "verified", true),
                Map.of("email", "main@example.com", "primary", true, "verified", true));

        assertThat(GitHubOAuth2UserService.verifiedPrimaryEmail(emails)).isEqualTo("main@example.com");
    }

    @Test
    void rejectsUnverifiedPrimaryEmail() {
        List<Map<String, Object>> emails = List.of(
                Map.of("email", "main@example.com", "primary", true, "verified", false));

        assertThat(GitHubOAuth2UserService.verifiedPrimaryEmail(emails)).isNull();
    }

    @Test
    void rejectsVerifiedButNonPrimaryEmail() {
        List<Map<String, Object>> emails = List.of(
                Map.of("email", "other@example.com", "primary", false, "verified", true));

        assertThat(GitHubOAuth2UserService.verifiedPrimaryEmail(emails)).isNull();
    }

    @Test
    void handlesMissingOrEmptyList() {
        assertThat(GitHubOAuth2UserService.verifiedPrimaryEmail(null)).isNull();
        assertThat(GitHubOAuth2UserService.verifiedPrimaryEmail(List.of())).isNull();
    }
}
