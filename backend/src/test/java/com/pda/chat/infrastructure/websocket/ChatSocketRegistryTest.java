package com.pda.chat.infrastructure.websocket;

import com.pda.auth.AuthenticatedSession;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

/**
 * The rules of {@link ChatSocketRegistry} without a server: which open sockets are ended, and that one broken socket
 * never keeps the others from being checked. (The real thing, with sockets and a database, is in
 * ChatWebSocketIntegrationTest.)
 */
class ChatSocketRegistryTest {

    private static final Instant START = Instant.parse("2026-10-03T10:00:00Z");

    /** A clock the test can move. */
    private static final class MovableClock extends Clock {
        private Instant now = START;

        void advance(Duration by) {
            now = now.plus(by);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final UserSessions sessions = mock(UserSessions.class);
    private final UserAccounts users = mock(UserAccounts.class);
    private final MovableClock clock = new MovableClock();
    // A very long period: the test drives the check by hand.
    private final ChatSocketRegistry registry = new ChatSocketRegistry(sessions, users, clock, 3_600_000);

    private final UUID userId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();
    private final AtomicInteger ids = new AtomicInteger();

    @AfterEach
    void stop() {
        registry.destroy();
    }

    private UserAccounts.AuthenticatedUser user() {
        return new UserAccounts.AuthenticatedUser(userId, "u@example.test", "u", "USER", false, null);
    }

    private void everythingValid() {
        when(sessions.isActive(eq(sessionId), eq(userId), any())).thenReturn(true);
        when(users.findActiveById(userId)).thenReturn(Optional.of(user()));
    }

    private WebSocketSession socket(AuthenticatedSession session) {
        WebSocketSession socket = mock(WebSocketSession.class);
        Map<String, Object> attributes = new HashMap<>();
        if (session != null) {
            attributes.put(ChatSocketRegistry.SESSION_ATTRIBUTE, session);
        }
        when(socket.getId()).thenReturn("socket-" + ids.incrementAndGet());
        when(socket.getAttributes()).thenReturn(attributes);
        when(socket.isOpen()).thenReturn(true);
        return socket;
    }

    private AuthenticatedSession session(Duration tokenLeft) {
        return new AuthenticatedSession(userId, sessionId, START.plus(tokenLeft));
    }

    private static void assertClosedByServer(WebSocketSession socket) throws IOException {
        verify(socket).close(CloseStatus.POLICY_VIOLATION.withReason("Session ended"));
    }

    @Test
    void aSocketWithAValidSessionAndTokenStaysOpen() throws Exception {
        everythingValid();
        WebSocketSession socket = socket(session(Duration.ofMinutes(15)));
        registry.register(socket);

        clock.advance(Duration.ofMinutes(5));
        registry.revalidate();

        verify(socket, never()).close(any());
        assertEquals(1, registry.openSockets());
    }

    @Test
    void aSocketIsClosedWhenItsAccessTokenHasExpired() throws Exception {
        everythingValid();
        WebSocketSession socket = socket(session(Duration.ofMinutes(15)));
        registry.register(socket);

        clock.advance(Duration.ofMinutes(15));
        registry.revalidate();

        assertClosedByServer(socket);
        assertEquals(0, registry.openSockets());
    }

    @Test
    void aSocketIsClosedWhenItsSessionWasRevokedOrExpired() throws Exception {
        when(users.findActiveById(userId)).thenReturn(Optional.of(user()));
        when(sessions.isActive(eq(sessionId), eq(userId), any())).thenReturn(true, false);
        WebSocketSession socket = socket(session(Duration.ofMinutes(15)));
        registry.register(socket);

        registry.revalidate();
        verify(socket, never()).close(any());

        registry.revalidate();
        assertClosedByServer(socket);
        assertEquals(0, registry.openSockets());
    }

    @Test
    void aSocketIsClosedWhenTheAccountIsNoLongerActive() throws Exception {
        when(sessions.isActive(eq(sessionId), eq(userId), any())).thenReturn(true);
        when(users.findActiveById(userId)).thenReturn(Optional.empty());
        WebSocketSession socket = socket(session(Duration.ofMinutes(15)));
        registry.register(socket);

        registry.revalidate();

        assertClosedByServer(socket);
    }

    @Test
    void aSocketWithoutSessionInformationIsClosedAtOnceAndNeverTracked() throws Exception {
        WebSocketSession socket = socket(null);

        registry.register(socket);

        verify(socket).close(CloseStatus.POLICY_VIOLATION.withReason("Unauthenticated"));
        assertEquals(0, registry.openSockets());
    }

    @Test
    void onlyTheInvalidSocketsAreClosed() throws Exception {
        UUID otherUser = UUID.randomUUID();
        UUID otherSession = UUID.randomUUID();
        everythingValid();
        when(sessions.isActive(eq(otherSession), eq(otherUser), any())).thenReturn(false);
        when(users.findActiveById(otherUser)).thenReturn(Optional.of(
                new UserAccounts.AuthenticatedUser(otherUser, "o@example.test", "o", "USER", false, null)));
        WebSocketSession good = socket(session(Duration.ofMinutes(15)));
        WebSocketSession revoked = socket(new AuthenticatedSession(otherUser, otherSession, START.plus(Duration.ofMinutes(15))));
        registry.register(good);
        registry.register(revoked);

        registry.revalidate();

        verify(good, never()).close(any());
        assertClosedByServer(revoked);
        assertEquals(1, registry.openSockets());
    }

    @Test
    void aSocketThatIsAlreadyClosedIsForgottenWithoutClosingItAgain() throws Exception {
        everythingValid();
        WebSocketSession socket = socket(session(Duration.ofMinutes(15)));
        registry.register(socket);
        when(socket.isOpen()).thenReturn(false);

        registry.revalidate();

        verify(socket, never()).close(any());
        assertEquals(0, registry.openSockets());
    }

    @Test
    void unregisteringStopsTheCheck() throws Exception {
        everythingValid();
        WebSocketSession socket = socket(session(Duration.ofMinutes(1)));
        registry.register(socket);
        registry.unregister(socket);

        clock.advance(Duration.ofMinutes(10));
        registry.revalidate();

        verify(socket, never()).close(any());
    }

    @Test
    void aFailingCheckOfOneSocketDoesNotStopTheOthers() throws Exception {
        UUID brokenUser = UUID.randomUUID();
        UUID brokenSession = UUID.randomUUID();
        when(sessions.isActive(eq(brokenSession), eq(brokenUser), any())).thenThrow(new IllegalStateException("db down"));
        when(sessions.isActive(eq(sessionId), eq(userId), any())).thenReturn(false);
        WebSocketSession broken = socket(new AuthenticatedSession(brokenUser, brokenSession, START.plus(Duration.ofMinutes(15))));
        WebSocketSession revoked = socket(session(Duration.ofMinutes(15)));
        registry.register(broken);
        registry.register(revoked);

        registry.revalidate();

        assertClosedByServer(revoked);
        verify(broken, never()).close(any());
        assertEquals(1, registry.openSockets(), "the socket whose check failed is checked again next time");
    }

    @Test
    void closingAnAlreadyDeadSocketIsHarmless() throws Exception {
        when(sessions.isActive(eq(sessionId), eq(userId), any())).thenReturn(false);
        when(users.findActiveById(userId)).thenReturn(Optional.of(user()));
        WebSocketSession socket = socket(session(Duration.ofMinutes(15)));
        doThrow(new IOException("gone")).when(socket).close(any());
        registry.register(socket);

        registry.revalidate();

        assertEquals(0, registry.openSockets());
    }
}
