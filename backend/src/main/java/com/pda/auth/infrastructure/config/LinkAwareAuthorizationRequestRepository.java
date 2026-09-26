package com.pda.auth.infrastructure.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

/**
 * Binds an "account linking" intent to one specific OAuth authorization request (and therefore to its
 * {@code state}). The intent is created by an authenticated, CSRF-protected POST that stores the user id in the
 * server-side session; it is consumed only by a start request carrying {@code intent=link}, so a plain login start
 * can never be turned into a link, and the callback reads the intent back from the state-bound request.
 */
public final class LinkAwareAuthorizationRequestRepository
        implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    public static final String SESSION_LINK_USER = "PDA_OAUTH_LINK_USER";
    public static final String REQUEST_LINK_USER = "PDA_OAUTH_LINK_USER";
    private static final String AUTHORIZATION_REQUEST_LINK_USER = "pda_link_user";

    private final HttpSessionOAuth2AuthorizationRequestRepository delegate =
            new HttpSessionOAuth2AuthorizationRequestRepository();

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        return delegate.loadAuthorizationRequest(request);
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest,
                                         HttpServletRequest request, HttpServletResponse response) {
        OAuth2AuthorizationRequest toSave = authorizationRequest;
        if (authorizationRequest != null && "link".equals(request.getParameter("intent"))) {
            HttpSession session = request.getSession(false);
            Object userId = session == null ? null : session.getAttribute(SESSION_LINK_USER);
            if (userId instanceof String id) {
                session.removeAttribute(SESSION_LINK_USER);
                toSave = OAuth2AuthorizationRequest.from(authorizationRequest)
                        .attributes(attributes -> attributes.put(AUTHORIZATION_REQUEST_LINK_USER, id)).build();
            }
        }
        delegate.saveAuthorizationRequest(toSave, request, response);
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
                                                                 HttpServletResponse response) {
        OAuth2AuthorizationRequest removed = delegate.removeAuthorizationRequest(request, response);
        if (removed != null) {
            Object userId = removed.getAttribute(AUTHORIZATION_REQUEST_LINK_USER);
            if (userId instanceof String id) {
                request.setAttribute(REQUEST_LINK_USER, id);
            }
        }
        return removed;
    }
}
