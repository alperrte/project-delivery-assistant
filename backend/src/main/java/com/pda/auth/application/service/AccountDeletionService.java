package com.pda.auth.application.service;

import com.pda.auth.domain.entity.AccountDeletionRequest;
import com.pda.auth.infrastructure.repository.AccountDeletionRequestRepository;
import com.pda.auth.infrastructure.repository.EmailVerificationChallengeRepository;
import com.pda.auth.infrastructure.repository.PasswordChangeChallengeRepository;
import com.pda.auth.infrastructure.repository.PasswordResetChallengeRepository;
import com.pda.project.ProjectOwnership;
import com.pda.user.UserAccounts;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deleting an account takes two steps that both have to be proven. {@link #request} mails a single-use link to the
 * signed-in user; the link opens a public page where {@link #confirm} asks for the email, the password (accounts
 * without one need only the email) and, when two-factor is on, an authenticator code. Deleting anonymises the account
 * in the user module; owning a project or an organization blocks it until that is handed over or deleted.
 */
@Service
public class AccountDeletionService {

    static final int MAX_TOKEN_LENGTH = 128;
    /** Slug of the public confirmation page per language; fixed here so the link never contains client-supplied text. */
    private static final String PAGE_TR = "hesap-sil";
    private static final String PAGE_EN = "delete-account";
    private static final String PAGE_DE = "konto-loeschen";

    private final AccountDeletionRequestRepository requests;
    private final EmailVerificationChallengeRepository verificationChallenges;
    private final PasswordResetChallengeRepository resetChallenges;
    private final PasswordChangeChallengeRepository changeChallenges;
    private final UserAccounts users;
    private final ProjectOwnership ownership;
    private final TotpService totp;
    private final ObjectProvider<VerificationMailPort> mail;
    private final Clock clock;
    private final String frontendUrl;
    private final SecureRandom random = new SecureRandom();

    public AccountDeletionService(AccountDeletionRequestRepository requests,
                                  EmailVerificationChallengeRepository verificationChallenges,
                                  PasswordResetChallengeRepository resetChallenges,
                                  PasswordChangeChallengeRepository changeChallenges, UserAccounts users,
                                  ProjectOwnership ownership, TotpService totp,
                                  ObjectProvider<VerificationMailPort> mail, Clock clock,
                                  @Value("${FRONTEND_URL}") String frontendUrl) {
        this.requests = requests;
        this.verificationChallenges = verificationChallenges;
        this.resetChallenges = resetChallenges;
        this.changeChallenges = changeChallenges;
        this.users = users;
        this.ownership = ownership;
        this.totp = totp;
        this.mail = mail;
        this.clock = clock;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
    }

    public enum RequestOutcome { SENT, OWNS_RESOURCES, ADMINISTRATOR, ACCOUNT_UNAVAILABLE }

    public record Requested(RequestOutcome outcome, List<ProjectOwnership.OwnedResource> owned) {
        static Requested of(RequestOutcome outcome) {
            return new Requested(outcome, List.of());
        }
    }

    public enum ConfirmOutcome {
        DELETED, INVALID_LINK, EXPIRED, CREDENTIALS_INVALID, TWO_FACTOR_REQUIRED, TWO_FACTOR_INVALID, TWO_FACTOR_LOCKED,
        OWNS_RESOURCES, ADMINISTRATOR
    }

    public record Confirmed(ConfirmOutcome outcome, List<ProjectOwnership.OwnedResource> owned) {
        static Confirmed of(ConfirmOutcome outcome) {
            return new Confirmed(outcome, List.of());
        }
    }

    /** A second request inside the 60 second cooldown is a silent no-op, so the mailbox cannot be flooded. */
    @Transactional
    public Requested request(UUID userId, MailLocale locale) {
        Optional<UserAccounts.AuthenticatedUser> user = users.findActiveById(userId);
        if (user.isEmpty()) {
            return Requested.of(RequestOutcome.ACCOUNT_UNAVAILABLE);
        }
        if (users.isAdministrator(userId)) {
            return Requested.of(RequestOutcome.ADMINISTRATOR);
        }
        List<ProjectOwnership.OwnedResource> owned = ownership.ownedBy(userId);
        if (!owned.isEmpty()) {
            return new Requested(RequestOutcome.OWNS_RESOURCES, owned);
        }
        if (!mail.getObject().available()) {
            throw new VerificationMailUnavailableException();
        }
        Instant now = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        Optional<AccountDeletionRequest> found = requests.findByUserId(userId);
        if (found.isPresent() && !found.get().canResend(now)) {
            return Requested.of(RequestOutcome.SENT);
        }
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hash = hash(token);
        if (found.isPresent()) {
            found.get().reissue(hash, now);
            requests.saveAndFlush(found.get());
        } else {
            requests.saveAndFlush(AccountDeletionRequest.issue(userId, hash, now));
        }
        mail.getObject().sendAccountDeletionLink(user.get().email(), link(token, locale), locale);
        return Requested.of(RequestOutcome.SENT);
    }

    /**
     * Failures are returned, never thrown, so the wrong-attempt counter commits with the transaction. A wrong email or
     * password is one answer: it never says which of the two was wrong.
     */
    @Transactional
    public Confirmed confirm(String token, String email, String password, String twoFactorCode) {
        if (token == null || token.isBlank() || token.length() > MAX_TOKEN_LENGTH) {
            return Confirmed.of(ConfirmOutcome.INVALID_LINK);
        }
        Instant now = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        Optional<AccountDeletionRequest> found = requests.lockByTokenHash(hash(token.strip()));
        if (found.isEmpty() || found.get().getConsumedAt() != null || found.get().getAttemptCount() >= 5) {
            return Confirmed.of(ConfirmOutcome.INVALID_LINK);
        }
        AccountDeletionRequest request = found.get();
        if (request.isExpired(now)) {
            return Confirmed.of(ConfirmOutcome.EXPIRED);
        }
        UUID userId = request.getUserId();
        Optional<UserAccounts.AuthenticatedUser> user = users.findActiveById(userId);
        if (user.isEmpty()) {
            return Confirmed.of(ConfirmOutcome.INVALID_LINK);
        }
        boolean emailMatches = email != null && user.get().email().equalsIgnoreCase(email.strip());
        boolean passwordMatches = !users.hasPassword(userId) || users.passwordMatches(userId, password);
        if (!emailMatches || !passwordMatches) {
            request.failedAttempt();
            requests.saveAndFlush(request);
            return Confirmed.of(ConfirmOutcome.CREDENTIALS_INVALID);
        }
        if (totp.isEnabled(userId)) {
            if (twoFactorCode == null || twoFactorCode.isBlank()) {
                return Confirmed.of(ConfirmOutcome.TWO_FACTOR_REQUIRED);
            }
            TotpService.Result result = totp.verify(userId, twoFactorCode);
            if (result == TotpService.Result.LOCKED) {
                return Confirmed.of(ConfirmOutcome.TWO_FACTOR_LOCKED);
            }
            if (result != TotpService.Result.OK) {
                request.failedAttempt();
                requests.saveAndFlush(request);
                return Confirmed.of(ConfirmOutcome.TWO_FACTOR_INVALID);
            }
        }
        if (users.isAdministrator(userId)) {
            return Confirmed.of(ConfirmOutcome.ADMINISTRATOR);
        }
        List<ProjectOwnership.OwnedResource> owned = ownership.ownedBy(userId);
        if (!owned.isEmpty()) {
            return new Confirmed(ConfirmOutcome.OWNS_RESOURCES, owned);
        }
        request.consume(now);
        requests.saveAndFlush(request);
        totp.disable(userId);
        verificationChallenges.deleteByUserId(userId);
        resetChallenges.deleteByUserId(userId);
        changeChallenges.deleteByUserId(userId);
        users.deleteAccount(userId);
        return Confirmed.of(ConfirmOutcome.DELETED);
    }

    private String link(String token, MailLocale locale) {
        String language = locale.name().toLowerCase(java.util.Locale.ROOT);
        String page = switch (locale) {
            case TR -> PAGE_TR;
            case EN -> PAGE_EN;
            case DE -> PAGE_DE;
        };
        return frontendUrl + "/" + language + "/" + page + "?token=" + token;
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
