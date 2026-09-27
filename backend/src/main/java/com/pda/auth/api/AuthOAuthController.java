package com.pda.auth.api;

import com.pda.auth.api.dto.response.LinkedProviderResponse;
import com.pda.auth.api.dto.response.OAuthLinkStartResponse;
import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.auth.infrastructure.config.LinkAwareAuthorizationRequestRepository;
import com.pda.user.OAuthProvider;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * Provider connection management for the authenticated user. Login itself is the Spring Security redirect flow
 * ({@code GET /api/v1/auth/oauth2/authorization/google}); nothing here trusts a client-supplied user id.
 */
@RestController
@RequestMapping("/api/v1/auth/oauth")
public class AuthOAuthController {

    private final UserAccounts users;
    private final JwtTokens tokens;
    private final AuthCookies cookies;
    private final ObjectProvider<ClientRegistrationRepository> registrations;

    public AuthOAuthController(UserAccounts users, JwtTokens tokens, AuthCookies cookies,
                               ObjectProvider<ClientRegistrationRepository> registrations) {
        this.users = users;
        this.tokens = tokens;
        this.cookies = cookies;
        this.registrations = registrations;
    }

    @GetMapping("/identities")
    @Operation(summary = "List my connected login providers",
            description = "Requires a valid access cookie. Returns provider name, provider email and link time only.")
    @ApiResponse(responseCode = "200", description = "Connected providers of the caller")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access cookie")
    public ResponseEntity<List<LinkedProviderResponse>> identities(HttpServletRequest request) {
        List<LinkedProviderResponse> body = users.listOAuthIdentities(identity(request).userId()).stream()
                .map(item -> new LinkedProviderResponse(item.provider().name(), item.email(), item.linkedAt()))
                .toList();
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(body);
    }

    @PostMapping("/{provider}/link")
    @Operation(summary = "Start connecting a provider (google, github) to my account",
            description = "Requires a valid access cookie and CSRF. Returns the URL the browser must navigate to; "
                    + "the result comes back to the frontend as `oauth_link` in the query string.")
    @ApiResponse(responseCode = "200", description = "Authorization URL to navigate to")
    @ApiResponse(responseCode = "404", description = "Unknown provider or provider login is not configured")
    public ResponseEntity<Object> startLink(@PathVariable String provider, HttpServletRequest request) {
        ClientRegistrationRepository repository = registrations.getIfAvailable();
        if (parse(provider).isEmpty() || repository == null || repository.findByRegistrationId(provider) == null) {
            return notFound();
        }
        UUID userId = identity(request).userId();
        request.getSession(true).setAttribute(LinkAwareAuthorizationRequestRepository.SESSION_LINK_USER,
                userId.toString());
        String url = ServletUriComponentsBuilder.fromContextPath(request)
                .path("/api/v1/auth/oauth2/authorization/" + provider).queryParam("intent", "link")
                .build().toUriString();
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(new OAuthLinkStartResponse(url));
    }

    @PostMapping("/{provider}/unlink")
    @Operation(summary = "Disconnect a provider (google, github) from my account",
            description = "Requires a valid access cookie and CSRF. Refused when the provider is the only way to sign in.")
    @ApiResponse(responseCode = "200", description = "Provider disconnected")
    @ApiResponse(responseCode = "404", description = "Unknown provider or not connected")
    @ApiResponse(responseCode = "409", description = "The provider is the only login method of this account")
    public ResponseEntity<Object> unlink(@PathVariable String provider, HttpServletRequest request) {
        Optional<OAuthProvider> parsed = parse(provider);
        if (parsed.isEmpty()) {
            return notFound();
        }
        UserAccounts.UnlinkOutcome outcome = users.unlinkOAuth(identity(request).userId(), parsed.get());
        return switch (outcome) {
            case UNLINKED -> ResponseEntity.ok().header("Cache-Control", "no-store").build();
            case NOT_LINKED -> notFound();
            case LAST_LOGIN_METHOD -> ResponseEntity.status(HttpStatus.CONFLICT).header("Cache-Control", "no-store")
                    .body(ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                            "This provider is the only login method of this account"));
        };
    }

    private static Optional<OAuthProvider> parse(String provider) {
        return Arrays.stream(OAuthProvider.values())
                .filter(candidate -> candidate.name().toLowerCase(Locale.ROOT).equals(provider)).findFirst();
    }

    private static ResponseEntity<Object> notFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).header("Cache-Control", "no-store")
                .body(ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Not found"));
    }

    private JwtTokens.AccessIdentity identity(HttpServletRequest request) {
        return tokens.parseAccess(cookies.access(request))
                .orElseThrow(() -> new IllegalStateException("Authenticated request without access identity"));
    }
}
