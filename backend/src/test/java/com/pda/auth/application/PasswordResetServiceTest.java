package com.pda.auth.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import com.pda.auth.application.service.MailLocale;
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

        service.forgot("missing@example.test", MailLocale.TR);

        verify(challenges, never()).saveAndFlush(any());
        verify(mailPort, never()).sendPasswordResetCode(anyString(), anyString(), any(MailLocale.class));
    }

    @Test
    void forgotIssuesAndEmailsACodeForAKnownActiveUser() {
        UUID userId = UUID.randomUUID();
        when(mailPort.available()).thenReturn(true);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.empty());
        when(challenges.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.forgot("member@example.test", MailLocale.TR);

        verify(challenges).saveAndFlush(any(PasswordResetChallenge.class));
        verify(mailPort).sendPasswordResetCode(eq("member@example.test"), anyString(), eq(MailLocale.TR));
    }

    @Test
    void forgotSendsNothingWhileTheAccountIsBlockedForTooManyWrongGuesses() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge blocked = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now.minusSeconds(600));
        for (int i = 0; i < 5; i++) {
            blocked.attempt(codes.hashResetCode(userId, "222222"), now.minusSeconds(590));
        }
        when(mailPort.available()).thenReturn(true);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(blocked));

        service.forgot("member@example.test", MailLocale.TR);

        verify(challenges, never()).saveAndFlush(any());
        verify(mailPort, never()).sendPasswordResetCode(anyString(), anyString(), any(MailLocale.class));
    }

    @Test
    void forgotDoesNotResendBeforeTheCooldownElapses() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge existing = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now.minusSeconds(10));
        when(mailPort.available()).thenReturn(true);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(existing));

        service.forgot("member@example.test", MailLocale.TR);

        verify(challenges, never()).saveAndFlush(any());
        verify(mailPort, never()).sendPasswordResetCode(anyString(), anyString(), any(MailLocale.class));
    }

    @Test
    void forgotFailsClosedWhenMailIsUnavailableRegardlessOfEmail() {
        when(mailPort.available()).thenReturn(false);

        org.junit.jupiter.api.Assertions.assertThrows(VerificationMailUnavailableException.class,
                () -> service.forgot("anyone@example.test", MailLocale.TR));
        verify(users, never()).findActiveByEmail(anyString());
    }

    @Test
    void verifyIsInvalidForAnUnknownEmail() {
        when(users.findActiveByEmail("missing@example.test")).thenReturn(Optional.empty());

        var check = service.verifyCode("missing@example.test", "123456");

        assertEquals(ResetResult.INVALID, check.result());
        assertNull(check.userId());
    }

    @Test
    void verifyIsInvalidWhenNoChallengeWasIssued() {
        UUID userId = UUID.randomUUID();
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.empty());

        assertEquals(ResetResult.INVALID, service.verifyCode("member@example.test", "123456").result());
    }

    @Test
    void verifyIsInvalidForAWrongCodeAndHandsOutNoTicket() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));

        var check = service.verifyCode("member@example.test", "222222");

        assertEquals(ResetResult.INVALID, check.result());
        assertNull(check.ticketRef());
    }

    @Test
    void verifyExpiresAfterFifteenMinutes() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now.minusSeconds(16 * 60));
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));

        assertEquals(ResetResult.EXPIRED, service.verifyCode("member@example.test", "111111").result());
    }

    @Test
    void verifyConsumesTheCodeSoItWorksOnlyOnce() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));

        var first = service.verifyCode("member@example.test", "111111");
        var second = service.verifyCode("member@example.test", "111111");

        assertEquals(ResetResult.RESET, first.result());
        assertEquals(userId, first.userId());
        assertNotNull(first.ticketRef());
        assertEquals(ResetResult.INVALID, second.result());
        verify(users, never()).resetPassword(any(), anyString());
    }

    @Test
    void resetWithTheTicketSetsThePasswordRevokesSessionsAndWorksOnlyOnce() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));
        when(users.resetPassword(userId, "New-password-1")).thenReturn(true);
        var ticket = service.verifyCode("member@example.test", "111111");

        ResetResult first = service.reset(userId, ticket.ticketRef(), "New-password-1");
        ResetResult second = service.reset(userId, ticket.ticketRef(), "Other-password-1");

        assertEquals(ResetResult.RESET, first);
        assertEquals(ResetResult.INVALID, second);
        verify(users, times(1)).resetPassword(userId, "New-password-1");
        verify(sessions, times(1)).revokeAll(userId, now);
    }

    @Test
    void resetWithoutAcceptedCodeIsInvalid() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now);
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));
        String ref = Long.toString(java.time.temporal.ChronoUnit.MICROS.between(Instant.EPOCH, now));

        assertEquals(ResetResult.INVALID, service.reset(userId, ref, "New-password-1"));
        verify(users, never()).resetPassword(any(), anyString());
    }

    @Test
    void ticketOfAnEarlierCodeStopsWorkingWhenANewCodeIsIssued() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now.minusSeconds(120));
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));
        var ticket = service.verifyCode("member@example.test", "111111");

        challenge.resend(codes.hashResetCode(userId, "222222"), now);

        assertEquals(ResetResult.INVALID, service.reset(userId, ticket.ticketRef(), "New-password-1"));
        verify(users, never()).resetPassword(any(), anyString());
    }

    @Test
    void resetRejectsAGarbageTicketReference() {
        UUID userId = UUID.randomUUID();
        when(challenges.findByUserId(userId)).thenReturn(Optional.empty());

        assertEquals(ResetResult.INVALID, service.reset(userId, "not-a-number", "New-password-1"));
        assertEquals(ResetResult.INVALID, service.reset(userId, null, "New-password-1"));
    }

    @Test
    void resetStaysInvalidWhenTheAccountStoppedBeingActiveMidFlow() {
        UUID userId = UUID.randomUUID();
        PasswordResetChallenge challenge = PasswordResetChallenge.issue(userId, codes.hashResetCode(userId, "111111"),
                now);
        when(users.findActiveByEmail("member@example.test")).thenReturn(Optional.of(userId));
        when(challenges.findByUserId(userId)).thenReturn(Optional.of(challenge));
        when(users.resetPassword(userId, "New-password-1")).thenReturn(false);
        var ticket = service.verifyCode("member@example.test", "111111");

        assertEquals(ResetResult.INVALID, service.reset(userId, ticket.ticketRef(), "New-password-1"));
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
