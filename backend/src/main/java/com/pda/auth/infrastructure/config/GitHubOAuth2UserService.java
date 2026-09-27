package com.pda.auth.infrastructure.config;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * GitHub is plain OAuth2 (no ID token) and its profile email is optional and unverified. The email is therefore
 * taken only from the emails endpoint and only when it is GitHub's primary, verified address; otherwise the
 * attributes carry no verified email and login/onboarding rejects it. The token is used once and never logged.
 */
final class GitHubOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private static final Logger log = LoggerFactory.getLogger(GitHubOAuth2UserService.class);
    private static final String EMAILS_URI = "https://api.github.com/user/emails";

    private final OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate = new DefaultOAuth2UserService();
    private final RestClient http = RestClient.create();

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) {
        OAuth2User user = delegate.loadUser(request);
        Map<String, Object> attributes = new HashMap<>(user.getAttributes());
        String email = fetchVerifiedPrimaryEmail(request.getAccessToken().getTokenValue());
        attributes.put("email", email);
        attributes.put("email_verified", email != null);
        return new DefaultOAuth2User(user.getAuthorities(), attributes, "id");
    }

    private String fetchVerifiedPrimaryEmail(String accessToken) {
        try {
            List<Map<String, Object>> emails = http.get().uri(EMAILS_URI)
                    .headers(headers -> {
                        headers.setBearerAuth(accessToken);
                        headers.setAccept(List.of(MediaType.parseMediaType("application/vnd.github+json")));
                    })
                    .retrieve().body(new ParameterizedTypeReference<>() {});
            return verifiedPrimaryEmail(emails);
        } catch (RestClientException exception) {
            log.warn("GitHub email lookup failed: {}", exception.getClass().getSimpleName());
            return null;
        }
    }

    static String verifiedPrimaryEmail(List<Map<String, Object>> emails) {
        if (emails == null) {
            return null;
        }
        return emails.stream()
                .filter(entry -> Boolean.TRUE.equals(entry.get("primary"))
                        && Boolean.TRUE.equals(entry.get("verified")) && entry.get("email") instanceof String)
                .map(entry -> (String) entry.get("email"))
                .findFirst().orElse(null);
    }
}
