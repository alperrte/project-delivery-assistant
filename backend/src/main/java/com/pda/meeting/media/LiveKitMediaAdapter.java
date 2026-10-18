package com.pda.meeting.media;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pda.meeting.MeetingMediaPort;
import io.jsonwebtoken.Jwts;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Direct, bounded LiveKit Twirp client; retries are owned by the persisted lifecycle worker. */
@Component
public class LiveKitMediaAdapter implements MeetingMediaPort {
    static final ObjectMapper JSON = new ObjectMapper(JsonFactory.builder().streamReadConstraints(
            StreamReadConstraints.builder().maxNestingDepth(16).maxStringLength(65536).maxNumberLength(32).build()).build());
    private final MeetingMediaProperties properties;
    private final HttpClient client;

    public LiveKitMediaAdapter(MeetingMediaProperties properties, Environment environment) {
        properties.validate(environment);
        this.properties = properties;
        client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    @Override public void createRoom(String roomName, int maxParticipants) {
        call("CreateRoom", Map.of("name", roomName, "max_participants", maxParticipants,
                "empty_timeout", 86400, "departure_timeout", 60), Map.of("roomCreate", true), false);
    }
    @Override public MediaJoin issueToken(String roomName, String identity, String displayName, Duration ttl) {
        requireEnabled();
        if (ttl == null || ttl.isNegative() || ttl.isZero()) throw new IllegalArgumentException("Invalid media token lifetime");
        Duration bounded = ttl.compareTo(Duration.ofSeconds(120)) > 0 ? Duration.ofSeconds(120) : ttl;
        Instant expires = Instant.now().plus(bounded);
        Map<String, Object> grants = new LinkedHashMap<>();
        grants.put("room", roomName); grants.put("roomJoin", true);
        grants.put("canPublish", true); grants.put("canSubscribe", true);
        grants.put("canPublishSources", List.of("camera", "microphone", "screen_share", "screen_share_audio"));
        grants.put("canPublishData", false); grants.put("canUpdateOwnMetadata", false);
        String token = Jwts.builder().issuer(properties.getApiKey()).subject(identity).claim("name", displayName)
                .notBefore(Date.from(Instant.now().minusSeconds(1))).expiration(Date.from(expires))
                .claim("video", grants).signWith(key(), Jwts.SIG.HS256).compact();
        return new MediaJoin(properties.getWebsocketUrl(), token, expires);
    }
    @Override public void deleteRoom(String roomName) {
        call("DeleteRoom", Map.of("room", roomName), Map.of("roomCreate", true), true);
    }
    @Override public void removeParticipant(String roomName, String identity) {
        call("RemoveParticipant", Map.of("room", roomName, "identity", identity), admin(roomName), true);
    }
    @Override public void muteParticipant(String roomName, String identity) {
        JsonNode participant = call("GetParticipant", Map.of("room", roomName, "identity", identity), admin(roomName), true);
        for (JsonNode track : participant.path("tracks")) {
            JsonNode source = track.path("source");
            if ((source.isIntegralNumber() && source.asInt() == 2) || "MICROPHONE".equals(source.asText())) {
                String sid = track.path("sid").asText("");
                if (!sid.isBlank()) call("MutePublishedTrack", Map.of("room", roomName, "identity", identity,
                        "track_sid", sid, "muted", true), admin(roomName), true);
            }
        }
    }
    @Override public void sendData(String roomName, byte[] payload) {
        if (payload == null || payload.length > 15000) throw new IllegalArgumentException("Invalid media data size");
        call("SendData", Map.of("room", roomName, "data", Base64.getEncoder().encodeToString(payload),
                "kind", 0, "topic", "pda.meeting", "destination_identities", List.of()), admin(roomName), false);
    }
    @Override public List<MediaParticipant> listParticipants(String roomName) {
        JsonNode result = call("ListParticipants", Map.of("room", roomName), admin(roomName), true);
        if (result.has("participants") && !result.path("participants").isArray()) throw unavailable();
        List<MediaParticipant> participants = new ArrayList<>();
        for (JsonNode node : result.path("participants"))
            participants.add(new MediaParticipant(node.path("identity").asText(), node.path("name").asText()));
        return List.copyOf(participants);
    }
    @Override public boolean roomExists(String roomName) {
        JsonNode result = call("ListRooms", Map.of("names", List.of(roomName)), Map.of("roomList", true), false);
        if (result.has("rooms") && !result.path("rooms").isArray()) throw unavailable();
        for (JsonNode node : result.path("rooms")) if (roomName.equals(node.path("name").asText())) return true;
        return false;
    }
    private Map<String, Object> admin(String room) { return Map.of("room", room, "roomAdmin", true); }
    private SecretKeySpec key() { return new SecretKeySpec(properties.getApiSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"); }
    private void requireEnabled() { if (!properties.isEnabled()) throw unavailable(); }
    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Meeting media service is unavailable");
    }
    private JsonNode call(String method, Map<String, ?> body, Map<String, ?> grants, boolean missingAllowed) {
        requireEnabled();
        try {
            Instant now = Instant.now();
            String token = Jwts.builder().issuer(properties.getApiKey()).notBefore(Date.from(now.minusSeconds(1)))
                    .expiration(Date.from(now.plusSeconds(30))).claim("video", grants).signWith(key(), Jwts.SIG.HS256).compact();
            String base = properties.getApiUrl().replaceAll("/$", "");
            HttpRequest request = HttpRequest.newBuilder(URI.create(base + "/twirp/livekit.RoomService/" + method))
                    .timeout(Duration.ofSeconds(5)).header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofByteArray(JSON.writeValueAsBytes(body))).build();
            HttpResponse<byte[]> response = client.send(request, info -> new BoundedBodySubscriber(262144));
            if (response.statusCode() == 404 && missingAllowed) {
                JsonNode error = JSON.readTree(response.body());
                if (error != null && error.isObject() && "not_found".equals(error.path("code").asText()))
                    return JSON.createObjectNode();
                throw unavailable();
            }
            if (response.statusCode() != 200) throw unavailable();
            if (response.body().length == 0) {
                if (method.equals("ListRooms") || method.equals("ListParticipants") || method.equals("GetParticipant"))
                    throw unavailable();
                return JSON.createObjectNode();
            }
            JsonNode result = JSON.readTree(response.body());
            if (result == null || !result.isObject()) throw unavailable();
            return result;
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw unavailable(); }
        catch (Exception e) { throw unavailable(); }
    }
}
