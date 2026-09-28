package com.pda.auth.infrastructure.config;

import com.pda.auth.application.service.LocalLoginService.LoginTokens;
import com.pda.auth.application.service.OAuthLoginService;
import com.pda.auth.application.service.OAuthLoginService.FailureReason;
import com.pda.auth.application.service.OAuthLoginService.OAuthLoginException;
import com.pda.auth.application.service.OAuthLoginService.Profile;
import com.pda.user.OAuthProvider;
import com.pda.user.UserAccounts.LinkOutcome;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.OAuth2User;

/**
 * Finishes the provider redirect. The provider session is throw-away: PDA issues its own cookies (or links the
 * identity) and always redirects to the configured frontend origin, never to a request-supplied URL. Only
 * whitelisted result codes reach the redirect query; provider tokens and claims are never logged.
 */
public final class OAuthLoginHandlers {

    private static final Logger log = LoggerFactory.getLogger(OAuthLoginHandlers.class);

    private final OAuthLoginService oauth;
    private final AuthCookies cookies;
    private final String frontendOrigin;

    public OAuthLoginHandlers(OAuthLoginService oauth, AuthCookies cookies, String frontendUrl) {
        this.oauth = oauth;
        this.cookies = cookies;
        this.frontendOrigin = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
    }

    public void success(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException {
        String target;
        try {
            Profile profile = profile(authentication);
            Object linkUser = request.getAttribute(LinkAwareAuthorizationRequestRepository.REQUEST_LINK_USER);
            if (linkUser instanceof String userId) {
                LinkOutcome outcome = oauth.link(UUID.fromString(userId), profile);
                target = "/?oauth_link=" + linkCode(outcome);
            } else {
                LoginTokens tokens = oauth.login(profile, request.getHeader("User-Agent"));
                cookies.write(tokens, request, response);
                target = "/projects";
            }
        } catch (OAuthLoginException exception) {
            target = "/login?oauth_error=" + exception.reason().code();
        } catch (RuntimeException exception) {
            log.warn("OAuth login failed: {}", exception.getClass().getSimpleName());
            target = "/login?oauth_error=" + FailureReason.PROVIDER_ERROR.code();
        }
        finish(request, response, target);
    }

    public void failure(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException {
        String errorCode = exception instanceof OAuth2AuthenticationException oauthFailure
                ? oauthFailure.getError().getErrorCode() : "";
        log.warn("OAuth authentication failed: {}", exception.getClass().getSimpleName());
        String code = "access_denied".equals(errorCode) ? "access_denied" : FailureReason.PROVIDER_ERROR.code();
        finish(request, response, "/login?oauth_error=" + code);
    }

    private void finish(HttpServletRequest request, HttpServletResponse response, String target) throws IOException {
        // The provider-authenticated security context is not a PDA session; drop it and the flow's HTTP session.
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        response.setHeader("Cache-Control", "no-store");
        response.sendRedirect(frontendOrigin + target);
    }

    private static Profile profile(Authentication authentication) {
        if (!(authentication instanceof OAuth2AuthenticationToken token)) {
            throw new OAuthLoginException(FailureReason.PROVIDER_ERROR);
        }
        String registrationId = token.getAuthorizedClientRegistrationId();
        if ("google".equals(registrationId) && token.getPrincipal() instanceof OidcUser oidc) {
            return new Profile(OAuthProvider.GOOGLE, oidc.getSubject(), oidc.getEmail(),
                    Boolean.TRUE.equals(oidc.getEmailVerified()), oidc.getFullName());
        }
        if ("github".equals(registrationId)) {
            // GitHubOAuth2UserService only sets a non-null email for GitHub's primary, verified address.
            OAuth2User user = token.getPrincipal();
            Object id = user.getAttribute("id");
            Object name = user.getAttribute("name");
            Object login = user.getAttribute("login");
            return new Profile(OAuthProvider.GITHUB, id == null ? null : String.valueOf(id),
                    user.getAttribute("email"), Boolean.TRUE.equals(user.getAttribute("email_verified")),
                    name instanceof String text && !text.isBlank() ? text : login instanceof String text ? text : null);
        }
        throw new OAuthLoginException(FailureReason.PROVIDER_ERROR);
    }

    private static String linkCode(LinkOutcome outcome) {
        return switch (outcome) {
            case LINKED -> "linked";
            case ALREADY_LINKED -> "already_linked";
            case IDENTITY_USED_BY_OTHER_ACCOUNT -> "linked_to_another_account";
            case PROVIDER_HAS_OTHER_IDENTITY -> "provider_already_linked";
            case ACCOUNT_UNAVAILABLE -> "account_unavailable";
        };
    }
}
