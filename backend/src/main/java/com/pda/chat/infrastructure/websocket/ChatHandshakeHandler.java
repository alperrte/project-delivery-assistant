package com.pda.chat.infrastructure.websocket;

import com.pda.user.UserAccounts;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

/**
 * Names the STOMP user by the user id taken from the authenticated handshake. The default would use the security
 * principal's {@code getName()}, which for an application user is its string form (and would include the email), and
 * it is the user id that {@code convertAndSendToUser} targets.
 */
final class ChatHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler handler,
                                      Map<String, Object> attributes) {
        UserAccounts.AuthenticatedUser user = ChatHandshakeInterceptor.authenticatedUser(request.getPrincipal());
        return user == null ? null : new ChatPrincipal(user.id().toString());
    }

    /** The only identity a chat socket has: the user id. */
    record ChatPrincipal(String userId) implements Principal {
        @Override
        public String getName() {
            return userId;
        }

        @Override
        public String toString() {
            return "ChatPrincipal";
        }
    }
}
