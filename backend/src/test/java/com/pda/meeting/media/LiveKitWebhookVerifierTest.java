package com.pda.meeting.media;

import static org.junit.jupiter.api.Assertions.*;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class LiveKitWebhookVerifierTest {
    private MeetingMediaProperties properties;
    private LiveKitWebhookVerifier verifier;
    private final byte[] body = "{\"id\":\"event-id\",\"event\":\"participant_joined\",\"room\":{\"name\":\"room\",\"sid\":\"RM_1\"},\"participant\":{\"identity\":\"actor\",\"sid\":\"PA_1\"},\"createdAt\":1700000000}".getBytes(StandardCharsets.UTF_8);
    @BeforeEach void setup() {
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        properties = new MeetingMediaProperties(); properties.setEnabled(true); properties.setApiKey("test-only-key");
        properties.setApiSecret(Base64.getEncoder().encodeToString(bytes)); verifier = new LiveKitWebhookVerifier(properties);
    }
    @Test void verifiedRawBodyProducesTypedEvent() throws Exception {
        var event = verifier.verify(body, token(body, Instant.now().minusSeconds(1), Instant.now().plusSeconds(30)));
        assertEquals("event-id", event.id()); assertEquals("room", event.roomName()); assertEquals("actor", event.identity());
        assertEquals(Instant.ofEpochSecond(1700000000), event.createdAt());
        assertEquals(event, verifier.verify(body, "Bearer " + token(body, Instant.now().minusSeconds(1), Instant.now().plusSeconds(30))));
    }
    @Test void modifiedBodyInvalidSignatureExpiryAndFutureNbfAreRejected() throws Exception {
        String valid = token(body, Instant.now().minusSeconds(1), Instant.now().plusSeconds(30));
        assertThrows(ResponseStatusException.class, () -> verifier.verify("{}".getBytes(StandardCharsets.UTF_8), valid));
        assertThrows(ResponseStatusException.class, () -> verifier.verify(body, valid.substring(0, valid.lastIndexOf('.') + 1) + "AAAA"));
        String expired = token(body, Instant.now().minusSeconds(60), Instant.now().minusSeconds(30));
        assertThrows(ResponseStatusException.class, () -> verifier.verify(body, expired));
        String future = token(body, Instant.now().plusSeconds(30), Instant.now().plusSeconds(60));
        assertThrows(ResponseStatusException.class, () -> verifier.verify(body, future));
    }
    @Test void boundedBodyAndDisabledServiceFailClosed() {
        assertEquals(413, assertThrows(ResponseStatusException.class,
                () -> verifier.verify(new byte[65537], "token")).getStatusCode().value());
        properties.setEnabled(false);
        assertEquals(503, assertThrows(ResponseStatusException.class,
                () -> verifier.verify(body, "token")).getStatusCode().value());
    }
    @Test void missingTimeClaimsWrongIssuerAndAlgorithmAreRejected() throws Exception {
        var key = new SecretKeySpec(properties.getApiSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        String hash = Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(body));
        String noTime = Jwts.builder().issuer(properties.getApiKey()).claim("sha256", hash).signWith(key, Jwts.SIG.HS256).compact();
        assertThrows(ResponseStatusException.class, () -> verifier.verify(body, noTime));
        String wrongIssuer = Jwts.builder().issuer("other-issuer").notBefore(Date.from(Instant.now().minusSeconds(1)))
                .expiration(Date.from(Instant.now().plusSeconds(30))).claim("sha256", hash).signWith(key, Jwts.SIG.HS256).compact();
        assertThrows(ResponseStatusException.class, () -> verifier.verify(body, wrongIssuer));
        String unsigned = Jwts.builder().issuer(properties.getApiKey()).claim("sha256", hash).compact();
        assertThrows(ResponseStatusException.class, () -> verifier.verify(body, unsigned));
    }
    private String token(byte[] raw, Instant nbf, Instant expiry) throws Exception {
        return Jwts.builder().issuer(properties.getApiKey()).notBefore(Date.from(nbf)).expiration(Date.from(expiry))
                .claim("sha256", Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(raw)))
                .signWith(new SecretKeySpec(properties.getApiSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"), Jwts.SIG.HS256).compact();
    }
}
