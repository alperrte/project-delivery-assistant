package com.pda.auth.application.service;

import com.pda.auth.domain.entity.PasswordResetChallenge;
import com.pda.auth.domain.entity.PasswordResetChallenge.AttemptResult;
import com.pda.auth.infrastructure.repository.PasswordResetChallengeRepository;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Forgot password" use cases in three steps: {@link #forgot} mails a code, {@link #verifyCode} consumes it, {@link
 * #reset} sets the new password for the holder of the resulting ticket. Reuses the {@code EmailVerificationChallenge} pattern
 * ({@link PasswordResetChallenge}, hashed/expiring/attempt-limited code) and the existing mail port; a successful
 * reset revokes every session of the account and clears any pending forced password change.
 */
@Service
public class PasswordResetService {

    private final UserAccounts users;
    private final UserSessions sessions;
    private final PasswordResetChallengeRepository challenges;
    private final VerificationCodeHasher codes;
    private final ObjectProvider<VerificationMailPort> mail;
    private final Clock clock;

    public PasswordResetService(UserAccounts users, UserSessions sessions, PasswordResetChallengeRepository challenges,
                                VerificationCodeHasher codes, ObjectProvider<VerificationMailPort> mail, Clock clock) {
        this.users = users;
        this.sessions = sessions;
        this.challenges = challenges;
        this.codes = codes;
        this.mail = mail;
        this.clock = clock;
    }

    /**
     * Never reveals whether the email is registered: unknown/inactive accounts and a resend still inside the
     * cooldown window are silently no-ops from the caller's point of view. Mail must be enabled.
     */
    @Transactional
    public void forgot(String email, MailLocale locale) {
        ensureMailAvailable();
        Optional<UUID> userId = users.findActiveByEmail(email);
        if (userId.isEmpty()) {
            return;
        }
        Instant now = now();
        Optional<PasswordResetChallenge> found = challenges.findByUserId(userId.get());
        // Silent like every other no-op here: while the account is blocked for too many wrong guesses a new code
        // would not be accepted anyway, so none is sent.
        if (found.isPresent() && (!found.get().canResend(now) || found.get().isBlocked(now))) {
            return;
        }
        String code = codes.newCode();
        String hash = codes.hashResetCode(userId.get(), code);
        if (found.isPresent()) {
            found.get().resend(hash, now);
            challenges.saveAndFlush(found.get());
        } else {
            challenges.saveAndFlush(PasswordResetChallenge.issue(userId.get(), hash, now));
        }
        mail.getObject().sendPasswordResetCode(email.strip(), code, locale);
    }

    /**
     * Step two: the mailed code is checked and consumed here, so it can never be tried again. On success the caller
     * gets what it needs to hand out the ticket for step three.
     */
    @Transactional
    public CodeCheck verifyCode(String email, String code) {
        Optional<UUID> userId = users.findActiveByEmail(email);
        if (userId.isEmpty()) {
            return CodeCheck.failed(ResetResult.INVALID);
        }
        Optional<PasswordResetChallenge> found = challenges.findByUserId(userId.get());
        if (found.isEmpty()) {
            return CodeCheck.failed(ResetResult.INVALID);
        }
        String candidateHash;
        try {
            candidateHash = codes.hashResetCode(userId.get(), code);
        } catch (IllegalArgumentException exception) {
            return CodeCheck.failed(ResetResult.INVALID);
        }
        PasswordResetChallenge challenge = found.get();
        AttemptResult result = challenge.attempt(candidateHash, now());
        challenges.saveAndFlush(challenge);
        return switch (result) {
            case VERIFIED -> new CodeCheck(ResetResult.RESET, userId.get(), ticketRef(challenge.getIssuedAt()));
            case WRONG, CONSUMED -> CodeCheck.failed(ResetResult.INVALID);
            case EXPIRED -> CodeCheck.failed(ResetResult.EXPIRED);
            case TOO_MANY_ATTEMPTS -> CodeCheck.failed(ResetResult.TOO_MANY_ATTEMPTS);
        };
    }

    /**
     * Step three: sets the new password for the holder of a ticket from {@link #verifyCode}. The ticket works once;
     * every session of the account ends.
     */
    @Transactional
    public ResetResult reset(UUID userId, String ticketRef, String newPassword) {
        Optional<PasswordResetChallenge> found = challenges.findByUserId(userId);
        Instant issuedAt = parseRef(ticketRef);
        if (found.isEmpty() || issuedAt == null || !found.get().ticketUsable(issuedAt)) {
            return ResetResult.INVALID;
        }
        Instant now = now();
        PasswordResetChallenge challenge = found.get();
        challenge.complete(now);
        try {
            challenges.saveAndFlush(challenge);
        } catch (ObjectOptimisticLockingFailureException concurrentUse) {
            return ResetResult.INVALID;
        }
        if (!users.resetPassword(userId, newPassword)) {
            return ResetResult.INVALID;
        }
        sessions.revokeAll(userId, now);
        return ResetResult.RESET;
    }

    private static String ticketRef(Instant issuedAt) {
        return Long.toString(ChronoUnit.MICROS.between(Instant.EPOCH, issuedAt));
    }

    private static Instant parseRef(String ref) {
        try {
            return Instant.EPOCH.plus(Long.parseLong(ref), ChronoUnit.MICROS);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private void ensureMailAvailable() {
        if (!mail.getObject().available()) {
            throw new VerificationMailUnavailableException();
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    public enum ResetResult { RESET, INVALID, EXPIRED, TOO_MANY_ATTEMPTS }

    /** Outcome of the code step; {@code userId} and {@code ticketRef} are set only when {@code result} is RESET. */
    public record CodeCheck(ResetResult result, UUID userId, String ticketRef) {
        static CodeCheck failed(ResetResult result) {
            return new CodeCheck(result, null, null);
        }
    }
}
