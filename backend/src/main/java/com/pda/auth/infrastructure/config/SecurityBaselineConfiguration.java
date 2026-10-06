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
import org.springframework.core.env.Environment;
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
import org.springframework.security.web.savedrequest.NullRequestCache;
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
                                           ObjectProvider<GitHubOAuth2UserService> gitHubUsers,
                                           @Value("${API_DOCS_ENABLED:false}") boolean apiDocsEnabled,
                                           Environment environment)
            throws Exception {
        ClientRegistrationRepository registrations = oauthRegistrations.getIfAvailable();
        OAuthLoginHandlers handlers = oauthHandlers.getIfAvailable();
        boolean oauthEnabled = registrations != null && handlers != null;
        if (oauthEnabled) {
            LinkAwareAuthorizationRequestRepository requestRepository = new LinkAwareAuthorizationRequestRepository();
            DefaultOAuth2AuthorizationRequestResolver pkceResolver =
                    new DefaultOAuth2AuthorizationRequestResolver(registrations, OAUTH_AUTHORIZATION_BASE);
            pkceResolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
            // Only configured providers have a start URL; any other id falls through to deny-by-default (403).
            OAuth2AuthorizationRequestResolver resolver = new OAuth2AuthorizationRequestResolver() {
                @Override
                public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
                    return isProviderStart(request) ? pkceResolver.resolve(request) : null;
                }

                @Override
                public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String registrationId) {
                    return registrationId != null && registrations.findByRegistrationId(registrationId) != null
                            && isProviderStart(request) ? pkceResolver.resolve(request, registrationId) : null;
                }

                private boolean isProviderStart(HttpServletRequest request) {
                    String uri = request.getRequestURI();
                    String prefix = request.getContextPath() + OAUTH_AUTHORIZATION_BASE + "/";
                    return uri.startsWith(prefix)
                            && registrations.findByRegistrationId(uri.substring(prefix.length())) != null;
                }
            };
            http.oauth2Login(login -> login
                    // No generated HTML login page: unauthenticated flows end in the failure handler instead.
                    .loginPage("/api/v1/auth/oauth/unavailable")
                    .authorizationEndpoint(endpoint -> endpoint.baseUri(OAUTH_AUTHORIZATION_BASE)
                            .authorizationRequestResolver(resolver)
                            .authorizationRequestRepository(requestRepository))
                    .redirectionEndpoint(endpoint -> endpoint.baseUri(OAUTH_CALLBACK_PATTERN))
                    .userInfoEndpoint(userInfo -> {
                        GitHubOAuth2UserService github = gitHubUsers.getIfAvailable();
                        if (github != null) {
                            userInfo.userService(github);
                        }
                    })
                    .successHandler(handlers::success)
                    .failureHandler(handlers::failure));
        }
        return http
                .cors(cors -> cors.configurationSource(corsSource))
                .csrf(csrf -> csrf.spa())
                // A 401 must not remember the request in an HttpSession: every anonymous probe would otherwise
                // allocate a server-side session (JSESSIONID) that lives for 30 minutes. OAuth keeps its own session use.
                .requestCache(cache -> cache.requestCache(new NullRequestCache()))
                .addFilterBefore(AuthRateLimitFilter.configured(environment), CsrfFilter.class)
                .addFilterBefore(new ProjectInvitationRateLimitFilter(), CsrfFilter.class)
                .addFilterBefore(new JwtCookieAuthenticationFilter(tokens, cookies, users, sessions, clock),
                        UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, failure) -> {
                            String path = request.getRequestURI().substring(request.getContextPath().length());
                            // Routes the application really serves answer a missing/expired session with 401, so the
                            // client can tell "renew the session" from "not allowed" (403, from the access-denied
                            // handler below) by the status alone. Anything else (unknown or switched-off routes) stays
                            // 403. Project and organization routes used to be missing here, so an expired access token
                            // made them answer 403, which the SPA showed as a permission error until the page reloaded.
                            boolean unauthenticated = "GET".equals(request.getMethod())
                                    && "/api/v1/auth/me".equals(path)
                                    || path.startsWith("/api/v1/auth/sessions")
                                    || path.startsWith("/api/v1/admin/")
                                    || "/api/v1/auth/password/change".equals(path)
                                    || path.startsWith("/api/v1/auth/oauth/")
                                    || path.equals("/api/v1/projects") || path.startsWith("/api/v1/projects/")
                                    || path.equals("/api/v1/organizations") || path.startsWith("/api/v1/organizations/")
                                    || path.startsWith("/api/v1/tasks/")
                                    || path.startsWith("/api/v1/users/")
                                    || path.equals("/api/v1/ws")
                                    || path.equals("/api/v1/project-invitations/me")
                                    || path.startsWith("/api/v1/project-invitations/")
                                    || path.equals("/api/v1/notifications") || path.startsWith("/api/v1/notifications/");
                            writeProblem(response, unauthenticated ? 401 : 403);
                        })
                        .accessDeniedHandler((request, response, failure) -> writeProblem(response, 403)))
                .authorizeHttpRequests(authorize -> {
                    if (apiDocsEnabled) {
                        authorize.requestMatchers(HttpMethod.GET, "/swagger-ui.html", "/swagger-ui/**",
                                "/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml").permitAll();
                    }
                    if (oauthEnabled) {
                        for (String provider : List.of("google", "github")) {
                            if (registrations.findByRegistrationId(provider) != null) {
                                authorize.requestMatchers(HttpMethod.GET, OAUTH_AUTHORIZATION_BASE + "/" + provider,
                                        OAUTH_CALLBACK_PATTERN.replace("*", provider)).permitAll();
                            }
                        }
                    }
                    authorize.requestMatchers(HttpMethod.GET, "/actuator/health", "/api/v1/auth/csrf").permitAll()
                            .requestMatchers(HttpMethod.GET, "/api/v1/project-invitations/me",
                                    "/api/v1/project-invitations/*/preview",
                                    "/api/v1/project-invitations/*/logo").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/project-invitations/external/preview").permitAll()
                            .requestMatchers(HttpMethod.POST, "/api/v1/project-invitations/external/accept").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/project-invitations/*/accept",
                                    "/api/v1/project-invitations/*/reject").authenticated()
                            .requestMatchers(HttpMethod.GET, "/api/v1/auth/oauth/identities").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/auth/oauth/*/link",
                                    "/api/v1/auth/oauth/*/unlink").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/register/invitation",
                                    "/api/v1/auth/login", "/api/v1/auth/refresh",
                                    "/api/v1/auth/logout", "/api/v1/auth/password/forgot",
                                    "/api/v1/auth/password/reset").permitAll()
                            .requestMatchers(HttpMethod.GET, "/api/v1/auth/me", "/api/v1/auth/sessions")
                            .authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/auth/sessions/*/revoke",
                                    "/api/v1/auth/sessions/revoke-others").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/auth/password/change").authenticated()
                            .requestMatchers(HttpMethod.GET, "/api/v1/users/me/preferences",
                                    "/api/v1/users/me/profile-photo", "/api/v1/users/*/profile-photo").authenticated()
                            .requestMatchers(HttpMethod.PUT, "/api/v1/users/me/preferences",
                                    "/api/v1/users/me/profile-photo").authenticated()
                            .requestMatchers(HttpMethod.DELETE, "/api/v1/users/me/profile-photo").authenticated()
                            .requestMatchers(HttpMethod.GET, "/api/v1/notifications", "/api/v1/notifications/unread-count").authenticated()
                            // Project chat WebSocket handshake (STOMP over native WebSocket); the PDA_ACCESS cookie is
                            // Path=/api, which is why the endpoint lives under /api.
                            .requestMatchers(HttpMethod.GET, "/api/v1/ws").authenticated()
                            .requestMatchers(HttpMethod.GET, "/api/v1/projects/*/chat/conversations/*/messages/reactions").authenticated()
                            .requestMatchers(HttpMethod.PUT, "/api/v1/projects/*/chat/conversations/*/messages/*/reactions/*").authenticated()
                            .requestMatchers(HttpMethod.DELETE, "/api/v1/projects/*/chat/conversations/*/messages/*/reactions/*").authenticated()
                            .requestMatchers(HttpMethod.PATCH, "/api/v1/notifications/read-all",
                                    "/api/v1/notifications/*/read").authenticated()
                            // Platform administration: ADMIN only; the services re-check the platform permission.
                            .requestMatchers(HttpMethod.GET, "/api/v1/admin/**").hasRole("ADMIN")
                            .requestMatchers(HttpMethod.POST, "/api/v1/admin/**").hasRole("ADMIN")
                            .requestMatchers(HttpMethod.GET, "/api/v1/projects", "/api/v1/projects/**",
                                    "/api/v1/organizations", "/api/v1/organizations/**").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/projects",
                                    "/api/v1/projects/*/tasks",
                                    "/api/v1/projects/*/archive", "/api/v1/organizations",
                                    "/api/v1/organizations/*/archive",
                                    "/api/v1/projects/*/members/*/roles",
                                    "/api/v1/projects/*/invitations",
                                    "/api/v1/projects/*/invitations/*/resend",
                                    "/api/v1/projects/*/invitations/*/accept",
                                    "/api/v1/projects/*/invitations/*/reject",
                                    "/api/v1/projects/*/squads",
                                    "/api/v1/projects/*/teams",
                                    "/api/v1/projects/*/teams/*/members",
                                    "/api/v1/projects/*/squads/*/archive",
                                    "/api/v1/projects/*/squads/*/members",
                                    "/api/v1/projects/*/criteria",
                                    "/api/v1/projects/*/criteria/*/complete",
                                    "/api/v1/projects/*/criteria/*/uncomplete",
                                    "/api/v1/projects/*/criteria/reorder",
                                    "/api/v1/projects/*/reminders",
                                    "/api/v1/projects/*/chat/direct/*",
                                    "/api/v1/projects/*/chat/conversations/*/messages",
                                    "/api/v1/projects/*/chat/conversations/*/read",
                                    "/api/v1/projects/*/repository").authenticated()
                            .requestMatchers(HttpMethod.POST, "/api/v1/projects/*/labels",
                                    "/api/v1/projects/*/sprints",
                                    "/api/v1/projects/*/sprints/*/start",
                                    "/api/v1/projects/*/sprints/*/complete",
                                    "/api/v1/projects/*/tasks/*/comments",
                                    "/api/v1/projects/*/tasks/*/relations",
                                    "/api/v1/projects/*/tasks/*/attachments",
                                    "/api/v1/projects/*/tasks/*/worklogs",
                                    "/api/v1/projects/*/tasks/*/checklist",
                                    "/api/v1/projects/*/tasks/*/claim",
                                    "/api/v1/projects/*/tasks/*/release").authenticated()
                            .requestMatchers(HttpMethod.PUT, "/api/v1/projects/*/tasks/*/labels",
                                    "/api/v1/projects/*/tasks/*/sprint",
                                    "/api/v1/projects/*/tasks/*/watch",
                                    "/api/v1/projects/*/tasks/*/checklist/order").authenticated()
                            .requestMatchers(HttpMethod.DELETE, "/api/v1/projects/*/labels/*",
                                    "/api/v1/projects/*/sprints/*",
                                    "/api/v1/projects/*/tasks/*/watch",
                                    "/api/v1/projects/*/tasks/*/comments/*",
                                    "/api/v1/projects/*/tasks/*/relations/*",
                                    "/api/v1/projects/*/tasks/*/attachments/*",
                                    "/api/v1/projects/*/tasks/*/worklogs/*",
                                    "/api/v1/projects/*/tasks/*/checklist/*").authenticated()
                            .requestMatchers(HttpMethod.PATCH, "/api/v1/projects/*/labels/*",
                                    "/api/v1/projects/*/sprints/*",
                                    "/api/v1/projects/*/tasks/*/comments/*",
                                    "/api/v1/projects/*/tasks/*/worklogs/*",
                                    "/api/v1/projects/*/tasks/*/checklist/*").authenticated()
                            .requestMatchers(HttpMethod.GET, "/api/v1/tasks/mine", "/api/v1/tasks/counts",
                                    "/api/v1/tasks/pool").authenticated()
                            .requestMatchers(HttpMethod.PUT, "/api/v1/projects/*",
                                    "/api/v1/projects/*/tasks/*/assignees",
                                    "/api/v1/organizations/*",
                                    "/api/v1/organizations/*/logo", "/api/v1/organizations/*/cover",
                                    "/api/v1/projects/*/members/*/roles",
                                    "/api/v1/projects/*/squads/*",
                                    "/api/v1/projects/*/teams/*",
                                    "/api/v1/projects/*/teams/*/parent",
                                    "/api/v1/projects/*/criteria/*",
                                    "/api/v1/projects/*/logo",
                                    "/api/v1/projects/*/banner").authenticated()
                            .requestMatchers(HttpMethod.DELETE, "/api/v1/organizations/*/logo", "/api/v1/organizations/*/cover",
                                    "/api/v1/projects/*/members/*",
                                    "/api/v1/projects/*/logo",
                                    "/api/v1/projects/*/banner",
                                    "/api/v1/projects/*/tasks/*",
                                    "/api/v1/projects/*/members/*/roles/*",
                                    "/api/v1/projects/*/invitations/*",
                                    "/api/v1/projects/*/repository",
                                    "/api/v1/projects/*/criteria/*",
                                    "/api/v1/projects/*/reminders/*",
                                    "/api/v1/projects/*/squads/*/members/*").authenticated()
                            .requestMatchers(HttpMethod.DELETE, "/api/v1/projects/*/teams/*",
                                    "/api/v1/projects/*/teams/*/members/*").authenticated()
                            .requestMatchers(HttpMethod.PATCH, "/api/v1/projects/*/task-management-mode",
                                    "/api/v1/projects/*/tasks/*",
                                    "/api/v1/projects/*/reminders/*",
                                    "/api/v1/projects/*/tasks/*/status",
                                    "/api/v1/projects/*/tasks/*/blocked").authenticated()
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
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
        // The browser client reads how long the access token stays valid to renew the session before it runs out.
        configuration.setExposedHeaders(List.of(JwtCookieAuthenticationFilter.ACCESS_EXPIRES_IN_HEADER));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/v1/auth/**", configuration);
        source.registerCorsConfiguration("/api/v1/admin/**", configuration);
        source.registerCorsConfiguration("/api/v1/projects", configuration);
        source.registerCorsConfiguration("/api/v1/projects/**", configuration);
        source.registerCorsConfiguration("/api/v1/tasks/**", configuration);
        source.registerCorsConfiguration("/api/v1/users/**", configuration);
        source.registerCorsConfiguration("/api/v1/organizations", configuration);
        source.registerCorsConfiguration("/api/v1/organizations/**", configuration);
        source.registerCorsConfiguration("/api/v1/notifications/**", configuration);
        source.registerCorsConfiguration("/api/v1/notifications", configuration);
        source.registerCorsConfiguration("/api/v1/project-invitations/**", configuration);
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
