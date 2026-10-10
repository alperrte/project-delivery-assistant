package com.pda.auth.application.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TotpTest {

    /** RFC 6238 appendix B (HMAC-SHA1): the 8-digit reference values, cut to the 6 digits authenticator apps show. */
    private static final byte[] RFC_SECRET = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

    @Test
    void matchesTheRfc6238ReferenceVectors() {
        assertEquals("287082", Totp.code(RFC_SECRET, Totp.stepOf(59)));
        assertEquals("081804", Totp.code(RFC_SECRET, Totp.stepOf(1111111109L)));
        assertEquals("050471", Totp.code(RFC_SECRET, Totp.stepOf(1111111111L)));
        assertEquals("005924", Totp.code(RFC_SECRET, Totp.stepOf(1234567890L)));
        assertEquals("279037", Totp.code(RFC_SECRET, Totp.stepOf(2000000000L)));
        assertEquals("353130", Totp.code(RFC_SECRET, Totp.stepOf(20000000000L)));
    }

    @Test
    void aStepIsThirtySecondsLong() {
        assertEquals(1, Totp.stepOf(59));
        assertEquals(2, Totp.stepOf(60));
        assertEquals(Totp.stepOf(30), Totp.stepOf(59));
    }

    @Test
    void acceptsTheCurrentAndTheNeighbouringStepsOnly() {
        long now = 1_000_000;
        assertEquals(now, Totp.matchingStep(RFC_SECRET, Totp.code(RFC_SECRET, now), now));
        assertEquals(now - 1, Totp.matchingStep(RFC_SECRET, Totp.code(RFC_SECRET, now - 1), now));
        assertEquals(now + 1, Totp.matchingStep(RFC_SECRET, Totp.code(RFC_SECRET, now + 1), now));
        assertEquals(-1, Totp.matchingStep(RFC_SECRET, Totp.code(RFC_SECRET, now - 2), now));
        assertEquals(-1, Totp.matchingStep(RFC_SECRET, Totp.code(RFC_SECRET, now + 2), now));
    }

    @Test
    void aCodeOfAnotherSecretIsRefused() {
        byte[] other = Totp.newSecret();
        assertEquals(-1, Totp.matchingStep(RFC_SECRET, Totp.code(other, 5), 5));
    }

    @Test
    void secretsAreTwentyRandomBytes() {
        byte[] first = Totp.newSecret();
        assertEquals(20, first.length);
        assertFalse(java.util.Arrays.equals(first, Totp.newSecret()));
    }

    @Test
    void base32FollowsRfc4648() {
        assertEquals("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", Totp.base32(RFC_SECRET));
        assertEquals("MZXW6YTBOI", Totp.base32("foobar".getBytes(StandardCharsets.US_ASCII)));
    }

    @Test
    void theQrLinkCarriesTheSecretAndEncodesTheLabel() {
        String uri = Totp.otpauthUri("PDA", "ada lovelace@example.test", RFC_SECRET);
        assertTrue(uri.startsWith("otpauth://totp/PDA:ada%20lovelace%40example.test?"));
        assertTrue(uri.contains("secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"));
        assertTrue(uri.contains("issuer=PDA"));
        assertTrue(uri.contains("digits=6"));
        assertTrue(uri.contains("period=30"));
    }

    // ---- TotpCrypto -------------------------------------------------------------------------------------

    private static String key() {
        byte[] bytes = new byte[32];
        new java.security.SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    @Test
    void withoutAKeyTwoFactorIsSwitchedOffInsteadOfStoringSecretsInThePlain() {
        TotpCrypto crypto = new TotpCrypto("");
        assertFalse(crypto.available());
        assertThrows(IllegalStateException.class, () -> crypto.encrypt(UUID.randomUUID(), RFC_SECRET));
    }

    @Test
    void aBrokenKeyStopsTheStartup() {
        assertThrows(IllegalStateException.class, () -> new TotpCrypto("not base64 !!"));
        assertThrows(IllegalStateException.class,
                () -> new TotpCrypto(Base64.getEncoder().encodeToString(new byte[16])));
    }

    @Test
    void aSecretRoundTripsAndIsBoundToItsOwner() {
        TotpCrypto crypto = new TotpCrypto(key());
        UUID owner = UUID.randomUUID();
        String sealed = crypto.encrypt(owner, RFC_SECRET);

        assertFalse(sealed.contains(Totp.base32(RFC_SECRET)));
        assertArrayEquals(RFC_SECRET, crypto.decrypt(owner, sealed));
        // The same bytes lifted onto another account's row do not open.
        assertThrows(IllegalStateException.class, () -> crypto.decrypt(UUID.randomUUID(), sealed));
        // Two encryptions of one secret differ (fresh IV).
        assertNotEquals(sealed, crypto.encrypt(owner, RFC_SECRET));
    }

    @Test
    void anotherKeyCannotReadTheSecret() {
        UUID owner = UUID.randomUUID();
        String sealed = new TotpCrypto(key()).encrypt(owner, RFC_SECRET);
        assertThrows(IllegalStateException.class, () -> new TotpCrypto(key()).decrypt(owner, sealed));
    }

    @Test
    void backupCodeHashesAreStableHexAndDifferPerUserAndKey() {
        String key = key();
        TotpCrypto crypto = new TotpCrypto(key);
        UUID ada = UUID.randomUUID();
        String hash = crypto.hashRecoveryCode(ada, "ABCDEFGHJK");

        assertTrue(hash.matches("[0-9a-f]{64}"));
        assertEquals(hash, new TotpCrypto(key).hashRecoveryCode(ada, "ABCDEFGHJK"));
        assertNotEquals(hash, crypto.hashRecoveryCode(UUID.randomUUID(), "ABCDEFGHJK"));
        assertNotEquals(hash, crypto.hashRecoveryCode(ada, "ABCDEFGHJL"));
        assertNotEquals(hash, new TotpCrypto(key()).hashRecoveryCode(ada, "ABCDEFGHJK"));
    }
}
