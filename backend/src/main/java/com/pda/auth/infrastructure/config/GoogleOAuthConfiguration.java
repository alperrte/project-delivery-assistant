package com.pda.auth.infrastructure.config;

import com.pda.auth.application.service.OAuthLoginService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;

/**
 * Google login is optional: with both variables empty none of these beans exist and every OAuth route stays
 * denied. Setting only one of them is a misconfiguration and stops startup.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnExpression("!'${GOOGLE_CLIENT_ID:}'.isBlank() || !'${GOOGLE_CLIENT_SECRET:}'.isBlank()")
class GoogleOAuthConfiguration {

    @Bean
    ClientRegistrationRepository googleClientRegistrationRepository(
            @Value("${GOOGLE_CLIENT_ID:}") String clientId, @Value("${GOOGLE_CLIENT_SECRET:}") String clientSecret) {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            throw new IllegalStateException("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together");
        }
        ClientRegistration google = CommonOAuth2Provider.GOOGLE.getBuilder("google")
                .clientId(clientId).clientSecret(clientSecret)
                .redirectUri("{baseUrl}/api/v1/auth/oauth2/callback/{registrationId}")
                .scope("openid", "email", "profile")
                .build();
        return new InMemoryClientRegistrationRepository(google);
    }

    @Bean
    OAuthLoginHandlers oauthLoginHandlers(OAuthLoginService oauth, AuthCookies cookies,
                                          @Value("${FRONTEND_URL:}") String frontendUrl) {
        return new OAuthLoginHandlers(oauth, cookies, frontendUrl);
    }
}
