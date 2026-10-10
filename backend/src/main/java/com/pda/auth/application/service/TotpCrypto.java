package com.pda.auth.application.service;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Protects the authenticator secrets at rest (AES-256-GCM, bound to the owning user) and hashes the backup codes.
 * The key comes from {@code TOTP_ENCRYPTION_KEY} (Base64, exactly 32 bytes). Without it the application still starts,
 * but two-factor setup is switched off ({@link #available()}) instead of storing secrets unprotected.
 */
@Component
public class TotpCrypto {

    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecureRandom random = new SecureRandom();
    private final SecretKeySpec encryptionKey;
    private final SecretKeySpec recoveryKey;

    public TotpCrypto(@Value("${TOTP_ENCRYPTION_KEY:}") String encodedKey) {
        if (encodedKey == null || encodedKey.isBlank()) {
            encryptionKey = null;
            recoveryKey = null;
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(encodedKey.strip());
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("TOTP encryption key must be Base64 encoded");
        }
        if (bytes.length != 32) {
            throw new IllegalStateException("TOTP encryption key must contain exactly 32 bytes");
        }
        encryptionKey = new SecretKeySpec(bytes, "AES");
        // A second key derived from the first, so backup-code hashes and the cipher never share key material.
        recoveryKey = new SecretKeySpec(sha256("totp-recovery".getBytes(StandardCharsets.US_ASCII), bytes), "HmacSHA256");
    }

    public boolean available() {
        return encryptionKey != null;
    }

    String encrypt(UUID userId, byte[] plain) {
        requireKey();
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(aad(userId));
            byte[] sealed = cipher.doFinal(plain);
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + sealed.length)
                    .put(iv).put(sealed).array());
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("TOTP secret could not be protected", exception);
        }
    }

    byte[] decrypt(UUID userId, String stored) {
        requireKey();
        try {
            byte[] all = Base64.getDecoder().decode(stored);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey, new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            cipher.updateAAD(aad(userId));
            return cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalStateException("TOTP secret could not be read", exception);
        }
    }

    /** HMAC of a normalised backup code; only this is stored. */
    String hashRecoveryCode(UUID userId, String normalisedCode) {
        requireKey();
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(recoveryKey);
            return HexFormat.of().formatHex(
                    mac.doFinal((userId + ":" + normalisedCode).getBytes(StandardCharsets.US_ASCII)));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Backup code hashing is unavailable", exception);
        }
    }

    private void requireKey() {
        if (encryptionKey == null) {
            throw new IllegalStateException("Two-factor authentication is unavailable");
        }
    }

    private static byte[] aad(UUID userId) {
        return ("totp:" + userId).getBytes(StandardCharsets.US_ASCII);
    }

    private static byte[] sha256(byte[] domain, byte[] key) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(domain);
            return digest.digest(key);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
