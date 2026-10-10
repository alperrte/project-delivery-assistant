package com.pda.auth.application.service;

import com.pda.auth.domain.entity.PasswordChangeChallenge;
import com.pda.auth.domain.entity.PasswordChangeChallenge.AttemptResult;
import com.pda.auth.infrastructure.repository.PasswordChangeChallengeRepository;
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
 * The mail-code gate in front of "change my password" in the account settings: {@link #send} mails a code to the
 * signed-in user, {@link #verify} consumes it and returns the reference for a single-use ticket, and the password
 * change is allowed only while {@link #ticketUsable} holds, after which {@link #complete} spends the ticket.
 */
@Service
public class PasswordChangeCodeService {

    private final PasswordChangeChallengeRepository challenges;
    private final VerificationCodeHasher codes;
    private final ObjectProvider<VerificationMailPort> mail;
    private final Clock clock;

    public PasswordChangeCodeService(PasswordChangeChallengeRepository challenges, VerificationCodeHasher codes,
                                     ObjectProvider<VerificationMailPort> mail, Clock clock) {
        this.challenges = challenges;
        this.codes = codes;
        this.mail = mail;
        this.clock = clock;
    }

    /** A resend inside the cooldown, or while too many wrong guesses block the account, is a silent no-op. */
    @Transactional
    public void send(UUID userId, String email, MailLocale locale) {
        if (!mail.getObject().available()) {
            throw new VerificationMailUnavailableException();
        }
        Instant now = now();
        Optional<PasswordChangeChallenge> found = challenges.findByUserId(userId);
        if (found.isPresent() && (!found.get().canResend(now) || found.get().isBlocked(now))) {
            return;
        }
        String code = codes.newCode();
        String hash = codes.hashChangeCode(userId, code);
        if (found.isPresent()) {
            found.get().resend(hash, now);
            challenges.saveAndFlush(found.get());
        } else {
            challenges.saveAndFlush(PasswordChangeChallenge.issue(userId, hash, now));
        }
        mail.getObject().sendPasswordChangeCode(email.strip(), code, locale);
    }

    @Transactional
    public CodeCheck verify(UUID userId, String code) {
        Optional<PasswordChangeChallenge> found = challenges.findByUserId(userId);
        if (found.isEmpty()) {
            return CodeCheck.failed(Result.INVALID);
        }
        String candidateHash;
        try {
            candidateHash = codes.hashChangeCode(userId, code);
        } catch (IllegalArgumentException exception) {
            return CodeCheck.failed(Result.INVALID);
        }
        PasswordChangeChallenge challenge = found.get();
        AttemptResult result = challenge.attempt(candidateHash, now());
        challenges.saveAndFlush(challenge);
        return switch (result) {
            case VERIFIED -> new CodeCheck(Result.VERIFIED, ticketRef(challenge.getIssuedAt()));
            case WRONG, CONSUMED -> CodeCheck.failed(Result.INVALID);
            case EXPIRED -> CodeCheck.failed(Result.EXPIRED);
            case TOO_MANY_ATTEMPTS -> CodeCheck.failed(Result.TOO_MANY_ATTEMPTS);
        };
    }

    @Transactional(readOnly = true)
    public boolean ticketUsable(UUID userId, String ticketRef) {
        Instant issuedAt = parseRef(ticketRef);
        return issuedAt != null && challenges.findByUserId(userId)
                .map(challenge -> challenge.ticketUsable(issuedAt)).orElse(false);
    }

    /** Spends the ticket; false when it was already spent or replaced by a newer code in the meantime. */
    @Transactional
    public boolean complete(UUID userId, String ticketRef) {
        Instant issuedAt = parseRef(ticketRef);
        Optional<PasswordChangeChallenge> found = challenges.findByUserId(userId);
        if (issuedAt == null || found.isEmpty() || !found.get().ticketUsable(issuedAt)) {
            return false;
        }
        found.get().complete(now());
        try {
            challenges.saveAndFlush(found.get());
        } catch (ObjectOptimisticLockingFailureException concurrentUse) {
            return false;
        }
        return true;
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

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    public enum Result { VERIFIED, INVALID, EXPIRED, TOO_MANY_ATTEMPTS }

    public record CodeCheck(Result result, String ticketRef) {
        static CodeCheck failed(Result result) {
            return new CodeCheck(result, null);
        }
    }
}
