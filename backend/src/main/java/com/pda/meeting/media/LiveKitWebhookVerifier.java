package com.pda.meeting.media;

import com.fasterxml.jackson.databind.JsonNode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class LiveKitWebhookVerifier {
    public static final int MAX_BODY_BYTES = 65536;
    private final MeetingMediaProperties properties;
    public LiveKitWebhookVerifier(MeetingMediaProperties properties) { this.properties = properties; }

    public VerifiedWebhook verify(byte[] rawBody, String authorization) {
        if (!properties.isEnabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Meeting media service is unavailable");
        if (rawBody == null || rawBody.length == 0 || rawBody.length > MAX_BODY_BYTES)
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Invalid media webhook size");
        try {
            if (authorization == null || authorization.length() > 8192) throw new IllegalArgumentException();
            String token = authorization.startsWith("Bearer ") ? authorization.substring(7) : authorization;
            var jwt = Jwts.parser().verifyWith(new SecretKeySpec(properties.getApiSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
                    .requireIssuer(properties.getApiKey()).sig().clear().add(Jwts.SIG.HS256).and().build().parseSignedClaims(token);
            Claims claims = jwt.getPayload();
            if (claims.getExpiration() == null || claims.getNotBefore() == null) throw new IllegalArgumentException();
            byte[] claimedHash = Base64.getDecoder().decode(claims.get("sha256", String.class));
            if (!MessageDigest.isEqual(MessageDigest.getInstance("SHA-256").digest(rawBody), claimedHash)) throw new IllegalArgumentException();
            JsonNode body = LiveKitMediaAdapter.JSON.readTree(rawBody);
            if (body == null || !body.isObject()) throw new IllegalArgumentException();
            String id = text(body, "id", 128), event = text(body, "event", 64);
            if (id.isBlank() || event.isBlank()) throw new IllegalArgumentException();
            JsonNode room = body.path("room"), participant = body.path("participant");
            long createdAt = body.path("createdAt").asLong(body.path("created_at").asLong(0));
            return new VerifiedWebhook(id, event, text(room, "name", 256), text(room, "sid", 128),
                    text(participant, "identity", 256), text(participant, "sid", 128), Instant.ofEpochSecond(createdAt));
        } catch (Exception e) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid media webhook"); }
    }
    private static String text(JsonNode node, String field, int max) {
        JsonNode value = node.path(field);
        if (value.isMissingNode()) return "";
        if (!value.isTextual() || value.textValue().length() > max) throw new IllegalArgumentException();
        return value.textValue();
    }
    public record VerifiedWebhook(String id, String event, String roomName, String roomSid,
            String identity, String participantSid, Instant createdAt) {}
}
