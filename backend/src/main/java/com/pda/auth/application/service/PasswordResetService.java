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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Forgot password" / "reset password" use cases. Reuses the {@code EmailVerificationChallenge} pattern
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
    public void forgot(String email) {
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
        mail.getObject().sendPasswordResetCode(email, code);
    }

    @Transactional
    public ResetResult reset(String email, String code, String newPassword) {
        Optional<UUID> userId = users.findActiveByEmail(email);
        if (userId.isEmpty()) {
            return ResetResult.INVALID;
        }
        Optional<PasswordResetChallenge> found = challenges.findByUserId(userId.get());
        if (found.isEmpty()) {
            return ResetResult.INVALID;
        }
        String candidateHash;
        try {
            candidateHash = codes.hashResetCode(userId.get(), code);
        } catch (IllegalArgumentException exception) {
            return ResetResult.INVALID;
        }
        PasswordResetChallenge challenge = found.get();
        Instant now = now();
        AttemptResult result = challenge.attempt(candidateHash, now);
        challenges.saveAndFlush(challenge);
        if (result != AttemptResult.VERIFIED) {
            return switch (result) {
                case WRONG, CONSUMED -> ResetResult.INVALID;
                case EXPIRED -> ResetResult.EXPIRED;
                case TOO_MANY_ATTEMPTS -> ResetResult.TOO_MANY_ATTEMPTS;
                case VERIFIED -> throw new IllegalStateException("Unexpected verification result");
            };
        }
        if (!users.resetPassword(userId.get(), newPassword)) {
            return ResetResult.INVALID;
        }
        sessions.revokeAll(userId.get(), now);
        return ResetResult.RESET;
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
}
