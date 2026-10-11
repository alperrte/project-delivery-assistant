package com.pda.auth.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.auth.application.service.VerificationCodeHasher;
import com.pda.auth.domain.entity.EmailVerificationChallenge;
import com.pda.auth.domain.entity.EmailVerificationChallenge.AttemptResult;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EmailVerificationChallengeTest {

    private final VerificationCodeHasher hasher = newHasher();

    @Test
    void codeIsHashedAndConsumedOnlyOnce() {
        UUID userId = UUID.randomUUID();
        Instant now = Instant.now();
        String code = hasher.newCode();
        String hash = hasher.hash(userId, code);
        EmailVerificationChallenge challenge = EmailVerificationChallenge.issue(userId, hash, now);

        assertEquals(6, code.length());
        assertTrue(code.matches("[0-9]{6}"));
        assertFalse(hash.contains(code));
        assertEquals(AttemptResult.WRONG, challenge.attempt(hasher.hash(userId, differentCode(code)), now));
        assertEquals(1, challenge.getAttemptCount());
        assertEquals(AttemptResult.VERIFIED, challenge.attempt(hash, now));
        assertEquals(AttemptResult.CONSUMED, challenge.attempt(hash, now));
    }

    @Test
    void cooldownAndAttemptLimitAreEnforced() {
        UUID userId = UUID.randomUUID();
        Instant now = Instant.now();
        String original = hasher.newCode();
        EmailVerificationChallenge challenge = EmailVerificationChallenge.issue(userId, hasher.hash(userId, original), now);

        assertFalse(challenge.canResend(now.plusSeconds(179)));
        assertTrue(challenge.canResend(now.plusSeconds(180)));
        String replacement = differentCode(original);
        challenge.resend(hasher.hash(userId, replacement), now.plusSeconds(180));
        for (int i = 0; i < 5; i++) {
            assertEquals(AttemptResult.WRONG, challenge.attempt(hasher.hash(userId, original), now.plusSeconds(181)));
        }
        assertEquals(AttemptResult.TOO_MANY_ATTEMPTS,
                challenge.attempt(hasher.hash(userId, replacement), now.plusSeconds(181)));
        assertEquals(AttemptResult.EXPIRED,
                challenge.attempt(hasher.hash(userId, replacement), now.plusSeconds(16 * 60)));
    }

    @Test
    void resendingKeepsTheOriginalDeadlineAndCannotReviveExpiredRegistration() {
        UUID userId = UUID.randomUUID();
        Instant now = Instant.parse("2026-10-11T12:00:00Z");
        String original = hasher.hash(userId, "123456");
        String replacement = hasher.hash(userId, "654321");
        EmailVerificationChallenge challenge = EmailVerificationChallenge.issue(userId, original, now);
        challenge.resend(replacement, now.plusSeconds(180));
        assertEquals(now, challenge.getIssuedAt());
        assertEquals(now.plusSeconds(900), challenge.getExpiresAt());
        assertFalse(challenge.canResend(now.plusSeconds(359)));
        assertTrue(challenge.canResend(now.plusSeconds(360)));
        assertEquals(AttemptResult.WRONG, challenge.attempt(original, now.plusSeconds(181)));
        assertFalse(challenge.canResend(now.plusSeconds(900)));
        assertThrows(IllegalStateException.class, () -> challenge.resend(original, now.plusSeconds(900)));
        assertEquals(AttemptResult.EXPIRED, challenge.attempt(replacement, now.plusSeconds(900)));
    }

    @Test
    void deferredVerificationCanStartWithoutKeyButRejectsHashing() {
        VerificationCodeHasher deferred = new VerificationCodeHasher("", true);
        assertThrows(IllegalStateException.class, () -> deferred.hash(UUID.randomUUID(), "123456"));
        assertThrows(IllegalStateException.class, () -> new VerificationCodeHasher("not-base64", true));
    }

    private static VerificationCodeHasher newHasher() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return new VerificationCodeHasher(Base64.getEncoder().encodeToString(key), true);
    }

    private static String differentCode(String code) {
        return String.format(java.util.Locale.ROOT, "%06d", (Integer.parseInt(code) + 1) % 1_000_000);
    }
}
