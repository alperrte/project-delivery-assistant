package com.pda.auth.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.auth.application.service.VerificationCodeHasher;
import com.pda.auth.domain.entity.PasswordResetChallenge;
import com.pda.auth.domain.entity.PasswordResetChallenge.AttemptResult;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PasswordResetChallengeTest {

    private final VerificationCodeHasher hasher = newHasher();

    @Test
    void codeIsHashedAndConsumedOnlyOnce() {
        UUID userId = UUID.randomUUID();
        Instant now = Instant.now();
        String code = hasher.newCode();
        String hash = hasher.hashResetCode(userId, code);
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, hash, now);

        assertEquals(6, code.length());
        assertTrue(code.matches("[0-9]{6}"));
        assertFalse(hash.contains(code));
        assertEquals(AttemptResult.WRONG, challenge.attempt(hasher.hashResetCode(userId, differentCode(code)), now));
        assertEquals(1, challenge.getAttemptCount());
        assertEquals(AttemptResult.VERIFIED, challenge.attempt(hash, now));
        assertEquals(AttemptResult.CONSUMED, challenge.attempt(hash, now));
    }

    @Test
    void cooldownAndAttemptLimitAreEnforced() {
        UUID userId = UUID.randomUUID();
        Instant now = Instant.now();
        String original = hasher.newCode();
        PasswordResetChallenge challenge =
                PasswordResetChallenge.issue(userId, hasher.hashResetCode(userId, original), now);

        assertFalse(challenge.canResend(now.plusSeconds(59)));
        assertTrue(challenge.canResend(now.plusSeconds(60)));
        String replacement = differentCode(original);
        challenge.resend(hasher.hashResetCode(userId, replacement), now.plusSeconds(60));
        for (int i = 0; i < 5; i++) {
            assertEquals(AttemptResult.WRONG,
                    challenge.attempt(hasher.hashResetCode(userId, original), now.plusSeconds(61)));
        }
        assertEquals(AttemptResult.TOO_MANY_ATTEMPTS,
                challenge.attempt(hasher.hashResetCode(userId, replacement), now.plusSeconds(61)));
        assertEquals(AttemptResult.EXPIRED,
                challenge.attempt(hasher.hashResetCode(userId, replacement), now.plusSeconds(16 * 60)));
    }

    @Test
    void aUsedChallengeCanBeReplacedByANewCodeForTheNextForgottenPassword() {
        UUID userId = UUID.randomUUID();
        Instant now = Instant.now();
        String first = hasher.newCode();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, hasher.hashResetCode(userId, first), now);
        assertEquals(AttemptResult.VERIFIED, challenge.attempt(hasher.hashResetCode(userId, first), now));
        assertEquals(AttemptResult.CONSUMED, challenge.attempt(hasher.hashResetCode(userId, first), now));

        // Later the same person forgets again: a new code is issued, the old one stays useless.
        Instant later = now.plusSeconds(3600);
        assertTrue(challenge.canResend(later));
        String second = differentCode(first);
        challenge.resend(hasher.hashResetCode(userId, second), later);
        assertEquals(AttemptResult.WRONG, challenge.attempt(hasher.hashResetCode(userId, first), later));
        assertEquals(AttemptResult.VERIFIED, challenge.attempt(hasher.hashResetCode(userId, second), later));
    }

    @Test
    void askingForNewCodesIsNoWayAroundTheHourlyLimitOfWrongGuesses() {
        UUID userId = UUID.randomUUID();
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        String first = hasher.newCode();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, hasher.hashResetCode(userId, first), start);
        String wrong = differentCode(first);
        // Two wrong guesses, a new code, three more: five in the window, spread over two codes.
        for (int i = 0; i < 2; i++) {
            assertEquals(AttemptResult.WRONG, challenge.attempt(hasher.hashResetCode(userId, wrong), start.plusSeconds(10)));
        }
        String second = differentCode(wrong);
        challenge.resend(hasher.hashResetCode(userId, second), start.plusSeconds(70));
        for (int i = 0; i < 3; i++) {
            assertEquals(AttemptResult.WRONG, challenge.attempt(hasher.hashResetCode(userId, wrong), start.plusSeconds(80)));
        }
        // Blocked: even the correct code is refused, and a further new code does not lift it.
        assertTrue(challenge.isBlocked(start.plusSeconds(90)));
        assertEquals(AttemptResult.TOO_MANY_ATTEMPTS, challenge.attempt(hasher.hashResetCode(userId, second), start.plusSeconds(90)));
        String third = differentCode(second);
        challenge.resend(hasher.hashResetCode(userId, third), start.plusSeconds(140));
        assertEquals(AttemptResult.TOO_MANY_ATTEMPTS, challenge.attempt(hasher.hashResetCode(userId, third), start.plusSeconds(150)));

        // After the hour the block ends and a fresh window starts.
        Instant later = start.plusSeconds(3700);
        assertFalse(challenge.isBlocked(later));
        String fourth = differentCode(third);
        challenge.resend(hasher.hashResetCode(userId, fourth), later);
        assertEquals(AttemptResult.VERIFIED, challenge.attempt(hasher.hashResetCode(userId, fourth), later.plusSeconds(1)));
    }

    @Test
    void resetAndVerificationHashesAreDomainSeparated() {
        UUID userId = UUID.randomUUID();
        String code = hasher.newCode();
        assertNotEquals(hasher.hash(userId, code), hasher.hashResetCode(userId, code));
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
