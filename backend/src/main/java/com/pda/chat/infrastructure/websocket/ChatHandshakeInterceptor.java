package com.pda.chat.infrastructure.websocket;

import com.pda.auth.AuthenticatedSession;
import com.pda.user.UserAccounts;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.security.Principal;
import java.util.Map;

/**
 * Defense in depth behind the security filter chain (which already answers 401 to a handshake without a valid
 * PDA_ACCESS cookie): the upgrade proceeds only for a request authenticated as an application user.
 */
final class ChatHandshakeInterceptor implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler,
                                   Map<String, Object> attributes) {
        UserAccounts.AuthenticatedUser user = authenticatedUser(request.getPrincipal());
        AuthenticatedSession session = request instanceof ServletServerHttpRequest servlet
                && servlet.getServletRequest().getAttribute(AuthenticatedSession.REQUEST_ATTRIBUTE)
                        instanceof AuthenticatedSession found ? found : null;
        if (user == null || session == null || !user.id().equals(session.userId())) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        // The registry re-checks this session for as long as the socket is open (ChatSocketRegistry).
        attributes.put(ChatSocketRegistry.SESSION_ATTRIBUTE, session);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler,
                               Exception exception) {
        // Nothing to clean up.
    }

    /** The application user behind a handshake principal, or null when it is not an authenticated application user. */
    static UserAccounts.AuthenticatedUser authenticatedUser(Principal principal) {
        if (principal instanceof Authentication authentication && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserAccounts.AuthenticatedUser user
                && user.id() != null) {
            return user;
        }
        return null;
    }
}
