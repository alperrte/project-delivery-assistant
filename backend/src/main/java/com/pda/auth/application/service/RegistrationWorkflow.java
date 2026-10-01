package com.pda.auth.application.service;

import com.pda.auth.domain.entity.EmailVerificationChallenge;
import com.pda.auth.domain.entity.EmailVerificationChallenge.AttemptResult;
import com.pda.auth.infrastructure.repository.EmailVerificationChallengeRepository;
import com.pda.user.UserAccounts;
import com.pda.project.ProjectInvitationOnboarding;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RegistrationWorkflow {

    private final UserAccounts users;
    private final ProjectInvitationOnboarding invitations;
    private final EmailVerificationChallengeRepository challenges;
    private final VerificationCodeHasher codes;
    private final ObjectProvider<VerificationMailPort> mail;
    private final Clock clock;

    public RegistrationWorkflow(UserAccounts users, ProjectInvitationOnboarding invitations,
                                EmailVerificationChallengeRepository challenges,
                                VerificationCodeHasher codes, ObjectProvider<VerificationMailPort> mail, Clock clock) {
        this.users = users;
        this.invitations = invitations;
        this.challenges = challenges;
        this.codes = codes;
        this.mail = mail;
        this.clock = clock;
    }

    @Transactional
    public void register(String email, String nickname, String password, String confirmPassword) {
        if (password == null || !password.equals(confirmPassword)) {
            throw new IllegalArgumentException("Password confirmation does not match");
        }
        users.registerLocal(email, nickname, password);
    }

    @Transactional
    public ProjectInvitationOnboarding.Accepted registerWithInvitation(String token, String email,
            String firstName, String lastName, String nickname, String password, String confirmPassword) {
        if (password == null || !password.equals(confirmPassword)) {
            throw new IllegalArgumentException("Password confirmation does not match");
        }
        var preview = invitations.preview(token);
        if (!preview.email().equalsIgnoreCase(email.strip())) {
            throw new IllegalArgumentException("Invitation identity mismatch");
        }
        UUID id = users.registerInvitedLocal(preview.email(), nickname, password,
                preview.firstName(), preview.lastName());
        return invitations.acceptNewAccount(token, id, email, firstName, lastName);
    }

    @Transactional
    public VerificationResult verify(String email, String code) {
        Optional<UUID> userId = users.findPendingByEmail(email);
        if (userId.isEmpty()) {
            return VerificationResult.INVALID;
        }
        Optional<EmailVerificationChallenge> found = challenges.findByUserId(userId.get());
        if (found.isEmpty()) {
            return VerificationResult.INVALID;
        }
        String candidateHash;
        try {
            candidateHash = codes.hash(userId.get(), code);
        } catch (IllegalArgumentException exception) {
            return VerificationResult.INVALID;
        }
        EmailVerificationChallenge challenge = found.get();
        AttemptResult result = challenge.attempt(candidateHash, now());
        challenges.saveAndFlush(challenge);
        if (result == AttemptResult.VERIFIED) {
            if (!users.activateVerifiedEmail(userId.get())) {
                throw new IllegalStateException("Account cannot be activated");
            }
            return VerificationResult.VERIFIED;
        }
        return switch (result) {
            case WRONG, CONSUMED -> VerificationResult.INVALID;
            case EXPIRED -> VerificationResult.EXPIRED;
            case TOO_MANY_ATTEMPTS -> VerificationResult.TOO_MANY_ATTEMPTS;
            case VERIFIED -> throw new IllegalStateException("Unexpected verification result");
        };
    }

    @Transactional
    public void resend(String email) {
        ensureMailAvailable();
        Optional<UUID> userId = users.findPendingByEmail(email);
        if (userId.isEmpty()) {
            return;
        }
        Instant now = now();
        Optional<EmailVerificationChallenge> found = challenges.findByUserId(userId.get());
        if (found.isPresent() && !found.get().canResend(now)) {
            return;
        }
        String code = codes.newCode();
        String hash = codes.hash(userId.get(), code);
        if (found.isPresent()) {
            found.get().resend(hash, now);
            challenges.saveAndFlush(found.get());
        } else {
            challenges.saveAndFlush(EmailVerificationChallenge.issue(userId.get(), hash, now));
        }
        mail.getObject().sendVerificationCode(email, code);
    }

    private void ensureMailAvailable() {
        if (!mail.getObject().available()) {
            throw new VerificationMailUnavailableException();
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    public enum VerificationResult { VERIFIED, INVALID, EXPIRED, TOO_MANY_ATTEMPTS }
}
