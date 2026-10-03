package com.pda.chat.infrastructure.websocket;

import com.pda.auth.AuthenticatedSession;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Keeps an open chat socket honest about who it belongs to. A WebSocket is authenticated once, at the handshake, and
 * would otherwise stay open after the person logs out, the session is revoked or expires, the account is disabled or
 * the access token it was opened with runs out. This registry remembers every open socket together with the
 * {@link AuthenticatedSession} of its handshake and, every {@code chat.ws.session-check-millis} (30 s by default),
 * closes the ones whose session or access token is no longer valid, on the server side.
 *
 * <p>Closing is harmless for a healthy client: it reconnects, which renews an expired access token through the normal
 * refresh flow and catches up on what it missed over REST. It never changes who may see what: delivery still checks
 * project membership for every message ({@link StompChatDelivery}) and the only destination is the caller's own
 * {@code /user/queue/chat}.
 */
@Component
class ChatSocketRegistry implements DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(ChatSocketRegistry.class);

    /** Attribute the handshake stores in the socket's session attributes. */
    static final String SESSION_ATTRIBUTE = ChatSocketRegistry.class.getName() + ".session";

    private final Map<String, WebSocketSession> open = new ConcurrentHashMap<>();
    private final UserSessions sessions;
    private final UserAccounts users;
    private final Clock clock;
    private final ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();

    public ChatSocketRegistry(UserSessions sessions, UserAccounts users, Clock clock,
                              @Value("${chat.ws.session-check-millis:30000}") long checkMillis) {
        this.sessions = sessions;
        this.users = users;
        this.clock = clock;
        long period = Math.max(checkMillis, 100);
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("chat-ws-session-check-");
        scheduler.initialize();
        scheduler.scheduleWithFixedDelay(this::revalidate, clock.instant().plusMillis(period), Duration.ofMillis(period));
    }

    /** Tracks a freshly opened socket; one that carries no session information is closed at once. */
    void register(WebSocketSession socket) {
        if (!(socket.getAttributes().get(SESSION_ATTRIBUTE) instanceof AuthenticatedSession)) {
            close(socket, "Unauthenticated");
            return;
        }
        open.put(socket.getId(), socket);
    }

    void unregister(WebSocketSession socket) {
        open.remove(socket.getId());
    }

    int openSockets() {
        return open.size();
    }

    /** Closes every tracked socket whose session or access token is no longer valid. Never throws. */
    void revalidate() {
        Instant now = clock.instant();
        for (WebSocketSession socket : open.values()) {
            try {
                if (!socket.isOpen()) {
                    open.remove(socket.getId());
                } else if (!stillValid(socket, now)) {
                    open.remove(socket.getId());
                    close(socket, "Session ended");
                }
            } catch (RuntimeException failure) {
                // One bad socket must not stop the check of the others; it is checked again next time.
                log.warn("Chat socket session check failed ({})", failure.getClass().getSimpleName());
            }
        }
    }

    private boolean stillValid(WebSocketSession socket, Instant now) {
        if (!(socket.getAttributes().get(SESSION_ATTRIBUTE) instanceof AuthenticatedSession session)) {
            return false;
        }
        return now.isBefore(session.accessExpiresAt())
                && sessions.isActive(session.sessionId(), session.userId(), now)
                && users.findActiveById(session.userId()).isPresent();
    }

    private static void close(WebSocketSession socket, String reason) {
        try {
            socket.close(CloseStatus.POLICY_VIOLATION.withReason(reason));
        } catch (IOException | RuntimeException failure) {
            log.debug("Chat socket was already gone while closing ({})", failure.getClass().getSimpleName());
        }
    }

    @Override
    public void destroy() {
        scheduler.shutdown();
    }
}
