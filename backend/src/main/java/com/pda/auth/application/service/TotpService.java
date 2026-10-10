package com.pda.auth.application.service;

import com.pda.auth.domain.entity.TotpCredential;
import com.pda.auth.domain.entity.TotpRecoveryCode;
import com.pda.auth.infrastructure.repository.TotpCredentialRepository;
import com.pda.auth.infrastructure.repository.TotpRecoveryCodeRepository;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Two-factor sign-in with an authenticator app. Setup is two steps (a secret is shown as a QR code, then the first code
 * proves the phone has it and yields the backup codes); afterwards {@link #verify} is the second step of every sign-in.
 */
@Service
public class TotpService {

    static final String ISSUER = "PDA";
    private static final int RECOVERY_CODES = 10;
    private static final String RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int RECOVERY_LENGTH = 10;
    private static final Pattern TOTP_CODE = Pattern.compile("[0-9]{6}");
    private static final Pattern RECOVERY_CODE = Pattern.compile("[A-HJ-NP-Z2-9]{" + RECOVERY_LENGTH + "}");

    private final TotpCredentialRepository credentials;
    private final TotpRecoveryCodeRepository recoveryCodes;
    private final TotpCrypto crypto;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public TotpService(TotpCredentialRepository credentials, TotpRecoveryCodeRepository recoveryCodes,
                       TotpCrypto crypto, Clock clock) {
        this.credentials = credentials;
        this.recoveryCodes = recoveryCodes;
        this.crypto = crypto;
        this.clock = clock;
    }

    public enum Result { OK, INVALID, LOCKED }

    /** The secret to show once (QR code and typed-in key) while the setup is not finished. */
    public record Setup(String secret, String otpauthUri) {}

    public record Status(boolean available, boolean enabled, long recoveryCodesLeft) {}

    public record Enabled(Result result, List<String> recoveryCodes) {}

    /** False when no TOTP_ENCRYPTION_KEY is configured: no secret can be stored or read. */
    public boolean available() {
        return crypto.available();
    }

    @Transactional(readOnly = true)
    public boolean isEnabled(UUID userId) {
        return credentials.findByUserId(userId).map(TotpCredential::isConfirmed).orElse(false);
    }

    @Transactional(readOnly = true)
    public Status status(UUID userId) {
        boolean enabled = isEnabled(userId);
        return new Status(crypto.available(), enabled, enabled ? recoveryCodes.countByUserIdAndUsedAtIsNull(userId) : 0);
    }

    /** Starts (or restarts) the setup. Throws {@link TwoFactorUnavailableException} when no key is configured. */
    @Transactional
    public Optional<Setup> beginSetup(UUID userId, String accountLabel) {
        if (!crypto.available()) {
            throw new TwoFactorUnavailableException();
        }
        Instant now = clock.instant();
        Optional<TotpCredential> existing = credentials.findByUserId(userId);
        if (existing.isPresent() && existing.get().isConfirmed()) {
            return Optional.empty();
        }
        byte[] secret = Totp.newSecret();
        String sealed = crypto.encrypt(userId, secret);
        if (existing.isPresent()) {
            existing.get().replaceSecret(sealed, now);
            credentials.saveAndFlush(existing.get());
        } else {
            credentials.saveAndFlush(TotpCredential.pending(userId, sealed, now));
        }
        return Optional.of(new Setup(Totp.base32(secret), Totp.otpauthUri(ISSUER, accountLabel, secret)));
    }

    /** Proves the first code of a pending setup, switches two-factor on and returns the backup codes (shown once). */
    @Transactional
    public Enabled enable(UUID userId, String code) {
        Optional<TotpCredential> found = credentials.findByUserId(userId);
        if (found.isEmpty() || found.get().isConfirmed()) {
            return new Enabled(Result.INVALID, List.of());
        }
        TotpCredential credential = found.get();
        Instant now = clock.instant();
        if (credential.isLocked(now)) {
            return new Enabled(Result.LOCKED, List.of());
        }
        String digits = normalise(code);
        long step = TOTP_CODE.matcher(digits).matches() ? matchingStep(credential, digits, now) : -1;
        if (step < 0) {
            return failed(credential, now, new Enabled(Result.INVALID, List.of()));
        }
        credential.confirm(step, now);
        try {
            credentials.saveAndFlush(credential);
        } catch (ObjectOptimisticLockingFailureException concurrentUse) {
            return new Enabled(Result.INVALID, List.of());
        }
        return new Enabled(Result.OK, issueRecoveryCodes(userId, now));
    }

    /**
     * The second step of a sign-in (and the proof for sensitive 2FA changes): a 6-digit authenticator code or one of the
     * backup codes. Each authenticator code works once, a backup code works once, and five wrong tries lock the
     * account's second factor for 15 minutes.
     */
    @Transactional
    public Result verify(UUID userId, String code) {
        return check(userId, code, true);
    }

    /** Like {@link #verify}, but backup codes are not accepted (they cannot produce new backup codes). */
    @Transactional
    public Result verifyAuthenticatorCode(UUID userId, String code) {
        return check(userId, code, false);
    }

    /** Switches two-factor off; the caller has already proven the password and a code. */
    @Transactional
    public void disable(UUID userId) {
        recoveryCodes.deleteByUserId(userId);
        credentials.deleteByUserId(userId);
        credentials.flush();
    }

    /** Replaces all backup codes with ten fresh ones. The caller has already proven a current authenticator code. */
    @Transactional
    public List<String> regenerateRecoveryCodes(UUID userId) {
        recoveryCodes.deleteByUserId(userId);
        recoveryCodes.flush();
        return issueRecoveryCodes(userId, clock.instant());
    }

    private Result check(UUID userId, String code, boolean allowRecovery) {
        Optional<TotpCredential> found = credentials.findByUserId(userId).filter(TotpCredential::isConfirmed);
        if (found.isEmpty()) {
            return Result.INVALID;
        }
        TotpCredential credential = found.get();
        Instant now = clock.instant();
        if (credential.isLocked(now)) {
            return Result.LOCKED;
        }
        String normalised = normalise(code);
        boolean accepted;
        if (TOTP_CODE.matcher(normalised).matches()) {
            long step = matchingStep(credential, normalised, now);
            accepted = step >= 0;
            if (accepted) {
                credential.accept(step);
            }
        } else if (allowRecovery && RECOVERY_CODE.matcher(normalised).matches()) {
            Optional<TotpRecoveryCode> backup = recoveryCodes.findByUserIdAndCodeHashAndUsedAtIsNull(
                    userId, crypto.hashRecoveryCode(userId, normalised));
            accepted = backup.isPresent();
            if (accepted) {
                backup.get().use(now);
                recoveryCodes.saveAndFlush(backup.get());
                credential.clearFailures();
            }
        } else {
            // Not even shaped like a code: a typing slip, not a guess, so it does not count against the account.
            return Result.INVALID;
        }
        if (!accepted) {
            credential.fail(now);
            credentials.saveAndFlush(credential);
            return credential.isLocked(now) ? Result.LOCKED : Result.INVALID;
        }
        try {
            credentials.saveAndFlush(credential);
        } catch (ObjectOptimisticLockingFailureException concurrentUse) {
            // The same code was presented twice at once; only one of the two may win.
            return Result.INVALID;
        }
        return Result.OK;
    }

    /** Step of an accepted code that is newer than the last one used, or -1. */
    private long matchingStep(TotpCredential credential, String digits, Instant now) {
        byte[] secret = crypto.decrypt(credential.getUserId(), credential.getSecretEncrypted());
        long step = Totp.matchingStep(secret, digits, Totp.stepOf(now.getEpochSecond()));
        return step > credential.getLastUsedStep() ? step : -1;
    }

    private <T> T failed(TotpCredential credential, Instant now, T answer) {
        credential.fail(now);
        credentials.saveAndFlush(credential);
        return answer;
    }

    private List<String> issueRecoveryCodes(UUID userId, Instant now) {
        List<String> plain = new ArrayList<>(RECOVERY_CODES);
        for (int index = 0; index < RECOVERY_CODES; index++) {
            StringBuilder code = new StringBuilder(RECOVERY_LENGTH);
            for (int position = 0; position < RECOVERY_LENGTH; position++) {
                code.append(RECOVERY_ALPHABET.charAt(random.nextInt(RECOVERY_ALPHABET.length())));
            }
            String value = code.toString();
            recoveryCodes.save(TotpRecoveryCode.issue(userId, crypto.hashRecoveryCode(userId, value), now));
            plain.add(value.substring(0, RECOVERY_LENGTH / 2) + "-" + value.substring(RECOVERY_LENGTH / 2));
        }
        recoveryCodes.flush();
        return plain;
    }

    /** Upper case, without spaces and dashes: how people type and copy codes. */
    private static String normalise(String code) {
        return code == null ? "" : code.replace(" ", "").replace("-", "").toUpperCase(java.util.Locale.ROOT);
    }
}
