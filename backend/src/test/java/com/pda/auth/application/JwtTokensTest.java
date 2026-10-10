package com.pda.auth.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.auth.application.service.JwtTokens;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtTokensTest {

    @Test
    void tokensHaveSeparatePurposesAndSessionBinding() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        JwtTokens tokens = new JwtTokens(Base64.getEncoder().encodeToString(key), 15, 7, Clock.systemUTC());
        UUID userId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String access = tokens.issueAccess(userId, sessionId).value();
        String refresh = tokens.issueRefresh(userId).value();
        assertEquals(userId, tokens.parseAccess(access).orElseThrow().userId());
        assertEquals(sessionId, tokens.parseAccess(access).orElseThrow().sessionId());
        assertEquals(userId, tokens.parseRefresh(refresh).orElseThrow());
        assertFalse(tokens.parseAccess(refresh).isPresent());
        assertFalse(tokens.parseRefresh(access).isPresent());
    }

    @Test
    void theAccessIdentityKnowsWhenItsTokenStopsBeingValid() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        JwtTokens tokens = new JwtTokens(Base64.getEncoder().encodeToString(key), 15, 7, Clock.systemUTC());
        JwtTokens.IssuedToken issued = tokens.issueAccess(UUID.randomUUID(), UUID.randomUUID());

        // A JWT carries whole seconds; the identity must report the very moment the token expires.
        assertEquals(issued.expiresAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS),
                tokens.parseAccess(issued.value()).orElseThrow().expiresAt());
    }

    @Test
    void everyTokenKindStopsWorkingAtItsOwnLifetime() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        java.time.Instant start = java.time.Instant.parse("2026-10-10T10:00:00Z");
        java.util.concurrent.atomic.AtomicReference<java.time.Instant> now = new java.util.concurrent.atomic.AtomicReference<>(start);
        Clock movable = new Clock() {
            @Override public java.time.ZoneId getZone() { return java.time.ZoneOffset.UTC; }
            @Override public Clock withZone(java.time.ZoneId zone) { return this; }
            @Override public java.time.Instant instant() { return now.get(); }
        };
        JwtTokens tokens = new JwtTokens(Base64.getEncoder().encodeToString(key), 15, 7, movable);
        UUID user = UUID.randomUUID();
        String access = tokens.issueAccess(user, UUID.randomUUID()).value();
        String refresh = tokens.issueRefresh(user).value();
        String ticket = tokens.issueTicket(user, "pwd_reset", "ref", java.time.Duration.ofMinutes(10)).value();

        now.set(start.plus(java.time.Duration.ofMinutes(9).plusSeconds(59)));
        assertTrue(tokens.parseAccess(access).isPresent());
        assertTrue(tokens.parseTicket(ticket, "pwd_reset").isPresent());

        now.set(start.plus(java.time.Duration.ofMinutes(10).plusSeconds(1)));
        assertFalse(tokens.parseTicket(ticket, "pwd_reset").isPresent());
        assertTrue(tokens.parseAccess(access).isPresent());

        now.set(start.plus(java.time.Duration.ofMinutes(15).plusSeconds(1)));
        assertFalse(tokens.parseAccess(access).isPresent());
        assertTrue(tokens.parseRefresh(refresh).isPresent());

        now.set(start.plus(java.time.Duration.ofDays(7).minusSeconds(1)));
        assertTrue(tokens.parseRefresh(refresh).isPresent());

        now.set(start.plus(java.time.Duration.ofDays(7).plusSeconds(1)));
        assertFalse(tokens.parseRefresh(refresh).isPresent());
    }

    @Test
    void missingOrPlaceholderSecretFailsFast() {
        assertThrows(IllegalStateException.class, () -> new JwtTokens("", 15, 7, Clock.systemUTC()));
        assertThrows(IllegalStateException.class,
                () -> new JwtTokens("change_me_with_a_long_random_secret", 15, 7, Clock.systemUTC()));
    }
}
