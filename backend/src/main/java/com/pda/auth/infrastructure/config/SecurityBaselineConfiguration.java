package com.pda.auth.infrastructure.config;

import java.net.URI;
import java.time.Clock;
import java.util.List;
import com.pda.auth.application.service.JwtTokens;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration(proxyBeanMethods = false)
public class SecurityBaselineConfiguration {

    private static final String OAUTH_AUTHORIZATION_BASE = "/api/v1/auth/oauth2/authorization";
    private static final String OAUTH_CALLBACK_PATTERN = "/api/v1/auth/oauth2/callback/*";

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, UrlBasedCorsConfigurationSource corsSource,
                                           JwtTokens tokens, AuthCookies cookies, UserAccounts users,
                                           UserSessions sessions, Clock clock,
                                           ObjectProvider<ClientRegistrationRepository> oauthRegistrations,
                                           ObjectProvider<OAuthLoginHandlers> oauthHandlers,
                                           @Value("${API_DOCS_ENABLED:false}") boolean apiDocsEnabled)
            throws Exception {
        ClientRegistrationRepository registrations = oauthRegistrations.getIfAvailable();
        OAuthLoginHandlers handlers = oauthHandlers.getIfAvailable();
        boolean oauthEnabled = registrations != null && handlers != null;
        if (oauthEnabled) {
            LinkAwareAuthorizationRequestRepository requestRepository = new LinkAwareAuthorizationRequestRepository();
            DefaultOAuth2AuthorizationRequestResolver pkceResolver =
                    new DefaultOAuth2AuthorizationRequestResolver(registrations, OAUTH_AUTHORIZATION_BASE);
            pkceResolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
            // Only the Google start URL is a flow; any other id falls through to deny-by-default (403).
            OAuth2AuthorizationRequestResolver resolver = new OAuth2AuthorizationRequestResolver() {
                @Override
                public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
                    return isGoogleStart(request) ? pkceResolver.resolve(request) : null;
                }

                @Override
                public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String registrationId) {
                    return "google".equals(registrationId) && isGoogleStart(request)
                            ? pkceResolver.resolve(request, registrationId) : null;
                }

                private boolean isGoogleStart(HttpServletRequest request) {
                    return (request.getContextPath() + OAUTH_AUTHORIZATION_BASE + "/google")
                            .equals(request.getRequestURI());
                }
            };
            http.oauth2Login(login -> login
                    // No generated HTML login page: unauthenticated flows end in the failure handler instead.
                    .loginPage("/api/v1/auth/oauth/unavailable")
                    .authorizationEndpoint(endpoint -> endpoint.baseUri(OAUTH_AUTHORIZATION_BASE)
                            .authorizationRequestResolver(resolver)
                            .authorizationRequestRepository(requestRepository))
                    .redirectionEndpoint(endpoint -> endpoint.baseUri(OAUTH_CALLBACK_PATTERN))
                    .successHandler(handlers::success)
                    .failureHandler(handlers::failure));
        }
        return http
                .cors(cors -> cors.configurationSource(corsSource))
                .csrf(csrf -> csrf.spa())
                .addFilterBefore(new AuthRateLimitFilter(), CsrfFilter.class)
                .addFilterBefore(new JwtCookieAuthenticationFilter(tokens, cookies, users, sessions, clock),
                        UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, failure) -> {
                            String path = request.getRequestURI().substring(request.getContextPath().length());
                            boolean unauthenticated = "GET".equals(request.getMethod())
                                    && "/api/v1/auth/me".equals(path)
                                    || path.startsWith("/api/v1/auth/sessions")
                                    || path.startsWith("/api/v1/auth/oauth/");
                            writeProblem(response, unauthenticated ? 401 : 403);
                        })
                        .accessDeniedHandler((request, response, failure) -> writeProblem(response, 403)))
                .authorizeHttpRequests(authorize -> {
                    if (apiDocsEnabled) {
                        authorize.requestMatchers(HttpMethod.GET, "/swagger-ui.html", "/swagger-ui/**",
                                "/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml").permitAll();
                    }
                    if (oauthEnabled) {
                        authorize.requestMatchers(HttpMethod.GET, OAUTH_AUTHORIZATION_BASE + "/google",
                                OAUTH_CALLBACK_PATTERN).permitAll();
                    }
                    authorize.requestMatchers(HttpMethod.GET, "/actuator/health", "/api/v1/auth/csrf").permitAll()
                            .requestMatchers(HttpMethod.GET, "/api/v1/auth/oauth/identities").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/auth/oauth/google/link",
                                    "/api/v1/auth/oauth/google/unlink").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/auth/register",
                                    "/api/v1/auth/login", "/api/v1/auth/refresh",
                                    "/api/v1/auth/logout").permitAll()
                            .requestMatchers(HttpMethod.GET, "/api/v1/auth/me", "/api/v1/auth/sessions")
                            .authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/auth/sessions/*/revoke",
                                    "/api/v1/auth/sessions/revoke-others").authenticated()
                            .requestMatchers(HttpMethod.GET, "/api/v1/projects", "/api/v1/projects/**",
                                    "/api/v1/organizations", "/api/v1/organizations/**").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/projects",
                                    "/api/v1/projects/*/archive", "/api/v1/organizations",
                                    "/api/v1/organizations/*/archive",
                                    "/api/v1/projects/*/members/*/roles").authenticated()
                            .requestMatchers(HttpMethod.PUT, "/api/v1/projects/*",
                                    "/api/v1/organizations/*",
                                    "/api/v1/projects/*/members/*/roles").authenticated()
                            .requestMatchers(HttpMethod.DELETE, "/api/v1/projects/*/members/*",
                                    "/api/v1/projects/*/members/*/roles/*").authenticated()
                            .anyRequest().denyAll();
                })
                .build();
    }

    @Bean
    UrlBasedCorsConfigurationSource corsConfigurationSource(@Value("${FRONTEND_URL:}") String frontendUrl) {
        if (frontendUrl.isBlank()) {
            throw new IllegalStateException("FRONTEND_URL is required for Auth CORS");
        }
        URI origin;
        try {
            origin = URI.create(frontendUrl);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("FRONTEND_URL must be an HTTP origin");
        }
        if (!("http".equals(origin.getScheme()) || "https".equals(origin.getScheme()))
                || origin.getHost() == null || origin.getRawPath() != null && !origin.getRawPath().isEmpty()
                || origin.getRawQuery() != null || origin.getRawFragment() != null || origin.getUserInfo() != null) {
            throw new IllegalStateException("FRONTEND_URL must be an HTTP origin");
        }
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(origin.toString()));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/v1/auth/**", configuration);
        source.registerCorsConfiguration("/api/v1/projects", configuration);
        source.registerCorsConfiguration("/api/v1/projects/**", configuration);
        source.registerCorsConfiguration("/api/v1/organizations", configuration);
        source.registerCorsConfiguration("/api/v1/organizations/**", configuration);
        return source;
    }

    @Bean
    UserDetailsService noBootstrapUser() {
        return username -> {
            throw new UsernameNotFoundException("Default Spring user authentication is disabled");
        };
    }

    private static void writeProblem(HttpServletResponse response, int status) throws IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json");
        response.setHeader("Cache-Control", "no-store");
        String title = status == 401 ? "Unauthorized" : "Forbidden";
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"" + title
                + "\",\"status\":" + status + "}");
    }
}
