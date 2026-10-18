package com.pda.meeting.media;

import static org.junit.jupiter.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;

class LiveKitMediaAdapterTest {
    private HttpServer server;
    private MeetingMediaProperties properties;
    private LiveKitMediaAdapter adapter;
    private final List<Request> requests = new ArrayList<>();
    private int status = 200;
    private String response = "{}";
    record Request(String path, String authorization, String body) {}
    @BeforeEach void setup() throws Exception {
        byte[] secret = new byte[32]; new SecureRandom().nextBytes(secret);
        properties = new MeetingMediaProperties();
        properties.setEnabled(true); properties.setApiKey("test-only-key");
        properties.setApiSecret(Base64.getEncoder().encodeToString(secret));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            requests.add(new Request(exchange.getRequestURI().getPath(), exchange.getRequestHeaders().getFirst("Authorization"),
                    new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
            byte[] body = response.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, body.length); exchange.getResponseBody().write(body); exchange.close();
        });
        server.start();
        properties.setApiUrl("http://127.0.0.1:" + server.getAddress().getPort());
        properties.setWebsocketUrl("ws://localhost:7880");
        MockEnvironment environment = new MockEnvironment(); environment.setActiveProfiles("dev");
        adapter = new LiveKitMediaAdapter(properties, environment);
    }
    @AfterEach void stop() { server.stop(0); }
    @SuppressWarnings("unchecked")
    @Test void participantGrantIsExactAndShortLived() {
        var join = adapter.issueToken("pda-room", "actor", "Display", Duration.ofHours(1));
        Claims claims = claims(join.token());
        Map<String, Object> video = (Map<String, Object>) claims.get("video");
        assertEquals("actor", claims.getSubject()); assertEquals("pda-room", video.get("room"));
        assertEquals(true, video.get("roomJoin")); assertEquals(false, video.get("canPublishData"));
        assertEquals(false, video.get("canUpdateOwnMetadata"));
        assertFalse(video.containsKey("roomAdmin")); assertFalse(video.containsKey("roomCreate")); assertFalse(video.containsKey("roomList"));
        assertEquals(List.of("camera", "microphone", "screen_share", "screen_share_audio"), video.get("canPublishSources"));
        assertTrue(claims.getExpiration().toInstant().isBefore(java.time.Instant.now().plusSeconds(121)));
        assertEquals("ws://localhost:7880", join.url()); assertTrue(requests.isEmpty());
    }
    @Test void roomCallsUseTwirpAndServerOnlyGrants() throws Exception {
        adapter.createRoom("stable-name", 25); adapter.createRoom("stable-name", 25);
        assertEquals(requests.get(0).body(), requests.get(1).body());
        assertEquals("/twirp/livekit.RoomService/CreateRoom", requests.getFirst().path());
        assertEquals(Map.of("roomCreate", true), claims(requests.getFirst().authorization().substring(7)).get("video"));
        assertEquals("stable-name", LiveKitMediaAdapter.JSON.readTree(requests.getFirst().body()).path("name").asText());
        response = "{\"rooms\":[{\"name\":\"stable-name\"}]}";
        assertTrue(adapter.roomExists("stable-name"));
        assertEquals(Map.of("roomList", true), claims(requests.getLast().authorization().substring(7)).get("video"));
    }
    @Test void onlyMicrophoneTracksCanBeMutedAndDataIsReliable() throws Exception {
        response = "{\"tracks\":[{\"sid\":\"mic1\",\"source\":\"MICROPHONE\"},{\"sid\":\"mic2\",\"source\":2},{\"sid\":\"screen\",\"source\":4}]}";
        adapter.muteParticipant("room", "actor"); assertEquals(3, requests.size());
        for (Request request : requests.subList(1, 3)) {
            var body = LiveKitMediaAdapter.JSON.readTree(request.body()); assertTrue(body.path("muted").asBoolean());
            assertTrue(body.path("track_sid").asText().startsWith("mic"));
            assertEquals(Map.of("room", "room", "roomAdmin", true), claims(request.authorization().substring(7)).get("video"));
        }
        adapter.sendData("room", "{}".getBytes(StandardCharsets.UTF_8));
        var data = LiveKitMediaAdapter.JSON.readTree(requests.getLast().body());
        assertEquals(0, data.path("kind").asInt()); assertEquals("pda.meeting", data.path("topic").asText());
    }
    @Test void providerFailuresDoNotBecomeEmptyRooms() {
        status = 503;
        assertEquals(503, assertThrows(ResponseStatusException.class, () -> adapter.roomExists("room")).getStatusCode().value());
        assertThrows(ResponseStatusException.class, () -> adapter.listParticipants("room"));
        status = 404;
        response = "{\"code\":\"not_found\",\"msg\":\"room not found\"}";
        assertThrows(ResponseStatusException.class, () -> adapter.roomExists("room"));
        assertTrue(adapter.listParticipants("room").isEmpty());
        assertDoesNotThrow(() -> adapter.deleteRoom("room"));
        assertThrows(ResponseStatusException.class, () -> adapter.createRoom("room", 20));
    }
    @Test void generic404CannotAcknowledgeDeletionOrMissingParticipants() {
        status = 404; response = "<html>proxy route not found</html>";
        assertThrows(ResponseStatusException.class, () -> adapter.deleteRoom("room"));
        assertThrows(ResponseStatusException.class, () -> adapter.roomExists("room"));
        assertThrows(ResponseStatusException.class, () -> adapter.listParticipants("room"));
        assertThrows(ResponseStatusException.class, () -> adapter.muteParticipant("room", "actor"));
        response = "{}";
        assertThrows(ResponseStatusException.class, () -> adapter.deleteRoom("room"));
    }
    @Test void emptyQueriesOrUnexpectedSuccessStatusFailClosed() {
        response = "";
        assertThrows(ResponseStatusException.class, () -> adapter.roomExists("room"));
        assertThrows(ResponseStatusException.class, () -> adapter.listParticipants("room"));
        assertThrows(ResponseStatusException.class, () -> adapter.muteParticipant("room", "actor"));
        status = 201; response = "{}";
        assertThrows(ResponseStatusException.class, () -> adapter.roomExists("room"));
    }
    @Test void disabledNeverReturnsFakeSuccess() {
        properties.setEnabled(false);
        assertThrows(ResponseStatusException.class, () -> adapter.issueToken("room", "actor", "Display", Duration.ofSeconds(60)));
        assertThrows(ResponseStatusException.class, () -> adapter.createRoom("room", 20));
        assertThrows(ResponseStatusException.class, () -> adapter.roomExists("room")); assertTrue(requests.isEmpty());
    }
    @Test void actualParticipantsAreReturnedAndMalformedOrOversizedResponsesFail() {
        response = "{\"participants\":[{\"identity\":\"actor\",\"name\":\"Display\"}]}";
        assertEquals("actor", adapter.listParticipants("room").getFirst().identity());
        response = "{\"rooms\":true}";
        assertThrows(ResponseStatusException.class, () -> adapter.roomExists("room"));
        response = "x".repeat(262145);
        assertThrows(ResponseStatusException.class, () -> adapter.roomExists("room"));
        response = "not-json";
        assertThrows(ResponseStatusException.class, () -> adapter.listParticipants("room"));
    }
    @Test void productionRejectsPlaintextEndpoints() {
        assertThrows(IllegalStateException.class, () -> new LiveKitMediaAdapter(properties, new MockEnvironment()));
        properties.setApiUrl("https://media.example.test"); properties.setWebsocketUrl("wss://media.example.test");
        assertDoesNotThrow(() -> new LiveKitMediaAdapter(properties, new MockEnvironment()));
    }
    private Claims claims(String token) {
        return Jwts.parser().verifyWith(new SecretKeySpec(properties.getApiSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
                .requireIssuer(properties.getApiKey()).build().parseSignedClaims(token).getPayload();
    }
}
