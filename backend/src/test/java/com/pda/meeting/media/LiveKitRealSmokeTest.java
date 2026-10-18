package com.pda.meeting.media;

import static org.junit.jupiter.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.mock.env.MockEnvironment;
import org.testcontainers.Testcontainers;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/** Opt-in actual RoomService and signed-webhook smoke, not a browser/WebRTC connectivity test. */
@EnabledIfSystemProperty(named = "pda.meeting.real-media-test", matches = "true")
class LiveKitRealSmokeTest {
    @Test void realSfuLifecycleAndSignedWebhook() throws Exception {
        byte[] random = new byte[48]; new SecureRandom().nextBytes(random);
        MeetingMediaProperties properties = new MeetingMediaProperties(); properties.setEnabled(true);
        properties.setApiKey("smoke_" + UUID.randomUUID().toString().replace("-", ""));
        properties.setApiSecret(Base64.getEncoder().encodeToString(random));
        LiveKitWebhookVerifier verifier = new LiveKitWebhookVerifier(properties);
        LinkedBlockingQueue<LiveKitWebhookVerifier.VerifiedWebhook> events = new LinkedBlockingQueue<>();
        LinkedBlockingQueue<Boolean> invalid = new LinkedBlockingQueue<>();
        HttpServer receiver = HttpServer.create(new InetSocketAddress("0.0.0.0", 0), 0);
        receiver.createContext("/webhook", exchange -> {
            try {
                events.add(verifier.verify(exchange.getRequestBody().readNBytes(65537), exchange.getRequestHeaders().getFirst("Authorization")));
                exchange.sendResponseHeaders(200, -1);
            } catch (Exception e) { invalid.add(true); exchange.sendResponseHeaders(401, -1); }
            finally { exchange.close(); }
        });
        receiver.start();
        try {
            Testcontainers.exposeHostPorts(receiver.getAddress().getPort());
            String config = "port: 7880\nbind_addresses: [\"0.0.0.0\"]\nrtc:\n  tcp_port: 7881\n  udp_port: 7882\n"
                    + "room:\n  auto_create: false\n  enable_remote_unmute: false\nwebhook:\n  api_key: " + properties.getApiKey()
                    + "\n  urls: [\"http://host.testcontainers.internal:" + receiver.getAddress().getPort() + "/webhook\"]\nlogging:\n  level: error\n";
            try (GenericContainer<?> livekit = new GenericContainer<>(DockerImageName.parse("livekit/livekit-server:v1.13.10"))
                    .withEnv("LIVEKIT_KEYS", properties.getApiKey() + ": " + properties.getApiSecret())
                    .withEnv("LIVEKIT_CONFIG", config).withExposedPorts(7880)
                    .waitingFor(Wait.forHttp("/").forStatusCode(200).withStartupTimeout(Duration.ofSeconds(60)))) {
                livekit.start();
                assertEquals(0, livekit.execInContainer("wget", "-q", "-O", "/dev/null", "http://127.0.0.1:7880/").getExitCode(),
                        "The configured Compose health command must work in the actual pinned image");
                properties.setApiUrl("http://" + livekit.getHost() + ":" + livekit.getMappedPort(7880));
                properties.setWebsocketUrl("ws://localhost:" + livekit.getMappedPort(7880));
                MockEnvironment environment = new MockEnvironment(); environment.setActiveProfiles("dev");
                LiveKitMediaAdapter adapter = new LiveKitMediaAdapter(properties, environment);
                String room = "pda-smoke-" + UUID.randomUUID();
                assertFalse(adapter.roomExists(room));
                try {
                    adapter.createRoom(room, 10); adapter.createRoom(room, 10);
                    assertTrue(adapter.roomExists(room)); assertTrue(adapter.listParticipants(room).isEmpty());
                    adapter.muteParticipant(room, "absent");
                    adapter.sendData(room, "{\"type\":\"smoke\"}".getBytes(StandardCharsets.UTF_8));
                    var join = adapter.issueToken(room, "test-participant", "Test", Duration.ofSeconds(120));
                    var claims = Jwts.parser().verifyWith(new SecretKeySpec(properties.getApiSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
                            .build().parseSignedClaims(join.token()).getPayload();
                    assertEquals(false, ((Map<?, ?>) claims.get("video")).get("canPublishData"));
                    var event = events.poll(30, TimeUnit.SECONDS);
                    assertNotNull(event, "LiveKit did not deliver a signed room webhook");
                    assertEquals(room, event.roomName()); assertEquals("room_started", event.event());
                    assertTrue(invalid.isEmpty(), "LiveKit sent a webhook rejected by the verifier");
                } finally { adapter.deleteRoom(room); }
                assertFalse(adapter.roomExists(room)); adapter.deleteRoom(room);
            }
        } finally { receiver.stop(0); }
    }
}
