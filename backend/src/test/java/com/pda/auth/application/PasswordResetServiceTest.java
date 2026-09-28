package com.pda.auth.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.pda.auth.application.service.PasswordResetService;
import com.pda.auth.application.service.PasswordResetService.ResetResult;
import com.pda.auth.application.service.VerificationCodeHasher;
import com.pda.auth.application.service.VerificationMailPort;
import com.pda.auth.application.service.VerificationMailUnavailableException;
import com.pda.auth.domain.entity.PasswordResetChallenge;
import com.pda.auth.infrastructure.repository.PasswordResetChallengeRepository;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

class PasswordResetServiceTest {

    private final UserAccounts users = mock(UserAccounts.class);
    private final UserSessions sessions = mock(UserSessions.class);
    private final PasswordResetChallengeRepository challenges = mock(PasswordResetChallengeRepository.class);
    private final VerificationMailPort mailPort = mock(VerificationMailPort.class);
    private final VerificationCodeHasher codes = newHasher();
    private final Instant now = Instant.parse("2026-01-01T00:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);
    private final PasswordResetService service = new PasswordResetService(users, sessions, challenges, codes,
            objectProvider(mailPort), clock);

    @Test
    void forgotIsSilentForAnUnknownEmailButStillEmailsNothing() {
        when(mailPort.available()).thenReturn(true);
        when(users.findActiveByEmail("missing@example.test")).thenReturn(Optional.empty());

        service.forgot("missing@example.test");

        verify(challenges, never()).saveAndFlush(any());
        verify(mailPort, never()).sendPasswordResetCode(anyString(), anyString());
    }

    @Test
    void forgotIssuesAndEmailsACodeForAKnownActiveUser() {
        UUID userId = UUID.randomUUID();
        when(mailPort.available()).thenReturn(true);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.empty());
        when(challenges.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.forgot("member@example.test");

        verify(challenges).saveAndFlush(any(PasswordResetChallenge.class));
        verify(mailPort).sendPasswordResetCode(eq("member@example.test"), anyString());
    }

    @Test
    void forgotDoesNotResendBeforeTheCooldownElapses() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge existing = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now.minusSeconds(10));
        when(mailPort.available()).thenReturn(true);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(existing));

        service.forgot("member@example.test");

        verify(challenges, never()).saveAndFlush(any());
        verify(mailPort, never()).sendPasswordResetCode(anyString(), anyString());
    }

    @Test
    void forgotFailsClosedWhenMailIsUnavailableRegardlessOfEmail() {
        when(mailPort.available()).thenReturn(false);

        org.junit.jupiter.api.Assertions.assertThrows(VerificationMailUnavailableException.class,
                () -> service.forgot("anyone@example.test"));
        verify(users, never()).findActiveByEmail(anyString());
    }

    @Test
    void resetIsInvalidForAnUnknownEmail() {
        when(users.findActiveByEmail("missing@example.test")).thenReturn(Optional.empty());

        ResetResult result = service.reset("missing@example.test", "123456", "new-password-1");

        assertEquals(ResetResult.INVALID, result);
        verify(sessions, never()).revokeAll(any(), any());
    }

    @Test
    void resetIsInvalidWhenNoChallengeWasIssued() {
        UUID userId = UUID.randomUUID();
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.empty());

        ResetResult result = service.reset("member@example.test", "123456", "new-password-1");

        assertEquals(ResetResult.INVALID, result);
    }

    @Test
    void resetIsInvalidForAWrongCode() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));

        ResetResult result = service.reset("member@example.test", "222222", "new-password-1");

        assertEquals(ResetResult.INVALID, result);
        verify(users, never()).resetPassword(any(), anyString());
    }

    @Test
    void resetExpiresAfterTenMinutes() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now.minusSeconds(11 * 60));
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));

        ResetResult result = service.reset("member@example.test", "111111", "new-password-1");

        assertEquals(ResetResult.EXPIRED, result);
    }

    @Test
    void resetSucceedsAndRevokesAllSessions() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));
        when(users.resetPassword(userId, "new-password-1")).thenReturn(true);

        ResetResult result = service.reset("member@example.test", "111111", "new-password-1");

        assertEquals(ResetResult.RESET, result);
        verify(users).resetPassword(userId, "new-password-1");
        verify(sessions, times(1)).revokeAll(userId, now);
    }

    @Test
    void resetStaysInvalidWhenTheAccountStoppedBeingActiveMidFlow() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));
        when(users.resetPassword(userId, "new-password-1")).thenReturn(false);

        ResetResult result = service.reset("member@example.test", "111111", "new-password-1");

        assertEquals(ResetResult.INVALID, result);
        verify(sessions, never()).revokeAll(any(), any());
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<VerificationMailPort> objectProvider(VerificationMailPort port) {
        ObjectProvider<VerificationMailPort> provider = mock(ObjectProvider.class);
        when(provider.getObject()).thenReturn(port);
        return provider;
    }

    private static VerificationCodeHasher newHasher() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return new VerificationCodeHasher(Base64.getEncoder().encodeToString(key), true);
    }
}
