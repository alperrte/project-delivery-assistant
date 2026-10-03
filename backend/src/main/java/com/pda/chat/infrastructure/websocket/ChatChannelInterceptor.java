package com.pda.chat.infrastructure.websocket;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;

/**
 * Authorization of every client STOMP frame, before anything handles it:
 *
 * <ul>
 *   <li>CONNECT needs the authenticated handshake identity;</li>
 *   <li>SUBSCRIBE is allowed to exactly {@code /user/queue/chat}, which the broker resolves to the caller's own
 *       sessions. Any other destination (a topic, somebody else's {@code /user/...}, a conversation id) is refused,
 *       so one user can never listen to another user's or another conversation's messages;</li>
 *   <li>SEND (and every other frame that could reach a handler) is refused: messages are sent over REST, where
 *       membership, validation and rate limiting live, so a socket can never carry a spoofed sender.</li>
 * </ul>
 *
 * A refused frame makes Spring answer with a STOMP ERROR frame and close the session.
 */
final class ChatChannelInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            // Heartbeats and internal messages carry no STOMP command.
            return message;
        }
        StompCommand command = accessor.getCommand();
        switch (command) {
            case CONNECT, STOMP -> {
                if (!(accessor.getUser() instanceof ChatHandshakeHandler.ChatPrincipal)) {
                    throw new MessagingException("Not authenticated");
                }
            }
            case SUBSCRIBE -> {
                if (!(accessor.getUser() instanceof ChatHandshakeHandler.ChatPrincipal)
                        || !ChatWebSocketConfiguration.SUBSCRIPTION.equals(accessor.getDestination())) {
                    throw new MessagingException("Subscription not allowed");
                }
            }
            case UNSUBSCRIBE, DISCONNECT -> {
                // Harmless bookkeeping frames.
            }
            default -> throw new MessagingException("Frame not allowed");
        }
        return message;
    }
}
