package com.pda.auth.application.service;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class VerificationCodeHasher {

    private final SecureRandom random = new SecureRandom();
    private final SecretKeySpec key;

    public VerificationCodeHasher(@Value("${EMAIL_VERIFICATION_HMAC_KEY:}") String encodedKey,
                                  @Value("${MAIL_ENABLED:false}") boolean mailEnabled) {
        if (encodedKey == null || encodedKey.isBlank()) {
            key = null;
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Email verification key must be Base64 encoded");
        }
        if (bytes.length < 32) {
            throw new IllegalStateException("Email verification key must contain at least 32 bytes");
        }
        key = new SecretKeySpec(bytes, "HmacSHA256");
    }

    public String newCode() {
        return String.format(java.util.Locale.ROOT, "%06d", random.nextInt(1_000_000));
    }

    /** Hashes an email-verification code. Domain-separated from {@link #hashResetCode} under the same key. */
    public String hash(UUID userId, String code) {
        return hmac("email-verify", userId, code);
    }

    /** Hashes a password-reset code. Reuses {@code EMAIL_VERIFICATION_HMAC_KEY} with a distinct domain prefix
     * so a reset code and a verification code for the same user/digits never hash to the same value. */
    public String hashResetCode(UUID userId, String code) {
        return hmac("pwd-reset", userId, code);
    }

    /** Hashes a password-change code (account settings), under its own domain prefix. */
    public String hashChangeCode(UUID userId, String code) {
        return hmac("pwd-change", userId, code);
    }

    private String hmac(String domain, UUID userId, String code) {
        if (key == null) {
            throw new IllegalStateException("Email verification is unavailable");
        }
        if (code == null || !code.matches("[0-9]{6}")) {
            throw new IllegalArgumentException("Verification code format is invalid");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            return HexFormat.of().formatHex(
                    mac.doFinal((domain + ":" + userId + ":" + code).getBytes(StandardCharsets.US_ASCII)));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Email verification hashing is unavailable", exception);
        }
    }
}
