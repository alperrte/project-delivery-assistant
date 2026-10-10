package com.pda.auth.application.service;

import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** RFC 6238 time-based one-time passwords (HMAC-SHA1, 6 digits, 30-second steps) on the JDK alone. */
final class Totp {

    static final int STEP_SECONDS = 30;
    private static final int DIGITS = 6;
    private static final int SECRET_BYTES = 20;
    private static final char[] BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {
    }

    static byte[] newSecret() {
        byte[] secret = new byte[SECRET_BYTES];
        RANDOM.nextBytes(secret);
        return secret;
    }

    static long stepOf(long epochSeconds) {
        return Math.floorDiv(epochSeconds, STEP_SECONDS);
    }

    /** The code for one 30-second step. */
    static String code(byte[] secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret, "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(Long.BYTES).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = (hash[offset] & 0x7f) << 24 | (hash[offset + 1] & 0xff) << 16
                    | (hash[offset + 2] & 0xff) << 8 | (hash[offset + 3] & 0xff);
            return String.format(java.util.Locale.ROOT, "%0" + DIGITS + "d", binary % 1_000_000);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("TOTP is unavailable", exception);
        }
    }

    /** The step whose code equals {@code candidate} within one step either side of {@code currentStep}, or -1. */
    static long matchingStep(byte[] secret, String candidate, long currentStep) {
        long match = -1;
        // Every step is compared, without stopping at the first hit, so timing says nothing about which one matched.
        for (long step = currentStep - 1; step <= currentStep + 1; step++) {
            if (step >= 0 && java.security.MessageDigest.isEqual(
                    code(secret, step).getBytes(StandardCharsets.US_ASCII),
                    candidate.getBytes(StandardCharsets.US_ASCII))) {
                match = step;
            }
        }
        return match;
    }

    /** Base32 (RFC 4648, no padding): what authenticator apps expect for a typed-in key. */
    static String base32(byte[] data) {
        StringBuilder out = new StringBuilder((data.length * 8 + 4) / 5);
        int buffer = 0;
        int bits = 0;
        for (byte value : data) {
            buffer = buffer << 8 | (value & 0xff);
            bits += 8;
            while (bits >= 5) {
                out.append(BASE32[buffer >> (bits - 5) & 31]);
                bits -= 5;
            }
        }
        if (bits > 0) {
            out.append(BASE32[buffer << (5 - bits) & 31]);
        }
        return out.toString();
    }

    /** The {@code otpauth://} link the QR code carries. */
    static String otpauthUri(String issuer, String account, byte[] secret) {
        String label = encode(issuer) + ":" + encode(account);
        return "otpauth://totp/" + label + "?secret=" + base32(secret) + "&issuer=" + encode(issuer)
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
