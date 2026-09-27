package com.pda.auth.infrastructure.config;

import com.pda.auth.application.service.OAuthLoginService;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;

/**
 * Each provider is optional: with both of its variables empty it is not registered and its routes stay denied.
 * Setting only one variable of a provider is a misconfiguration and stops startup.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnExpression("!'${GOOGLE_CLIENT_ID:}'.isBlank() || !'${GOOGLE_CLIENT_SECRET:}'.isBlank()"
        + " || !'${GITHUB_CLIENT_ID:}'.isBlank() || !'${GITHUB_CLIENT_SECRET:}'.isBlank()")
class OAuthProvidersConfiguration {

    private static final String REDIRECT_URI = "{baseUrl}/api/v1/auth/oauth2/callback/{registrationId}";

    @Bean
    ClientRegistrationRepository oauthClientRegistrationRepository(
            @Value("${GOOGLE_CLIENT_ID:}") String googleId, @Value("${GOOGLE_CLIENT_SECRET:}") String googleSecret,
            @Value("${GITHUB_CLIENT_ID:}") String githubId, @Value("${GITHUB_CLIENT_SECRET:}") String githubSecret) {
        List<ClientRegistration> registrations = new ArrayList<>();
        if (configured("GOOGLE", googleId, googleSecret)) {
            registrations.add(CommonOAuth2Provider.GOOGLE.getBuilder("google")
                    .clientId(googleId).clientSecret(googleSecret).redirectUri(REDIRECT_URI)
                    .scope("openid", "email", "profile").build());
        }
        if (configured("GITHUB", githubId, githubSecret)) {
            registrations.add(CommonOAuth2Provider.GITHUB.getBuilder("github")
                    .clientId(githubId).clientSecret(githubSecret).redirectUri(REDIRECT_URI)
                    .scope("read:user", "user:email").build());
        }
        return new InMemoryClientRegistrationRepository(registrations);
    }

    @Bean
    OAuthLoginHandlers oauthLoginHandlers(OAuthLoginService oauth, AuthCookies cookies,
                                          @Value("${FRONTEND_URL:}") String frontendUrl) {
        return new OAuthLoginHandlers(oauth, cookies, frontendUrl);
    }

    @Bean
    GitHubOAuth2UserService gitHubOAuth2UserService() {
        return new GitHubOAuth2UserService();
    }

    private static boolean configured(String provider, String id, String secret) {
        if (id.isBlank() != secret.isBlank()) {
            throw new IllegalStateException(provider + "_CLIENT_ID and " + provider
                    + "_CLIENT_SECRET must be set together");
        }
        return !id.isBlank();
    }
}
