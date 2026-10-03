package com.pda.chat.infrastructure.websocket;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

/**
 * Real-time transport for the project chat: native WebSocket speaking STOMP, nothing else.
 *
 * <ul>
 *   <li>The endpoint lives under {@code /api} because the {@code PDA_ACCESS} cookie is scoped to {@code Path=/api};
 *       the handshake therefore carries the HttpOnly access token and goes through the normal security filter chain
 *       (see SecurityBaselineConfiguration), which authenticates it from that cookie.</li>
 *   <li>Browsers must come from the configured frontend origin (cross-site WebSocket hijacking guard).</li>
 *   <li>The model is user-scoped: a client can only subscribe to {@code /user/queue/chat}, which Spring resolves to
 *       its own sessions, and cannot send anything (messages are sent over REST). There is no topic a client could
 *       name to listen to somebody else's conversation. See {@link ChatChannelInterceptor}.</li>
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSocketMessageBroker
public class ChatWebSocketConfiguration implements WebSocketMessageBrokerConfigurer, DisposableBean {

    public static final String ENDPOINT = "/api/v1/ws";
    public static final String USER_QUEUE = "/queue/chat";

    /** What a client subscribes to; the broker resolves the {@code /user} prefix to the caller's own sessions. */
    public static final String SUBSCRIPTION = "/user" + USER_QUEUE;

    private static final long HEARTBEAT_MILLIS = 10_000;

    private final String frontendUrl;
    /**
     * Drives the broker heartbeats. Deliberately not a bean: a public TaskScheduler bean would make Spring Boot back
     * off its own scheduler and silently change which executor the application's {@code @Scheduled} jobs use.
     */
    private final ThreadPoolTaskScheduler heartbeatScheduler = new ThreadPoolTaskScheduler();

    private final ChatSocketRegistry socketRegistry;

    public ChatWebSocketConfiguration(@Value("${FRONTEND_URL:}") String frontendUrl, ChatSocketRegistry socketRegistry) {
        this.socketRegistry = socketRegistry;
        if (frontendUrl.isBlank()) {
            throw new IllegalStateException("FRONTEND_URL is required for the chat WebSocket origin check");
        }
        this.frontendUrl = frontendUrl.strip();
        heartbeatScheduler.setPoolSize(1);
        heartbeatScheduler.setThreadNamePrefix("chat-ws-heartbeat-");
        heartbeatScheduler.initialize();
    }

    @Override
    public void destroy() {
        heartbeatScheduler.shutdown();
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint(ENDPOINT)
                .setAllowedOrigins(frontendUrl)
                .addInterceptors(new ChatHandshakeInterceptor())
                .setHandshakeHandler(new ChatHandshakeHandler());
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // No application destination prefix on purpose: nothing a client sends is routed to application code.
        registry.enableSimpleBroker("/queue")
                .setHeartbeatValue(new long[] {HEARTBEAT_MILLIS, HEARTBEAT_MILLIS})
                .setTaskScheduler(heartbeatScheduler);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChatChannelInterceptor());
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        // Clients only send tiny control frames (CONNECT/SUBSCRIBE); anything big is not chat.
        registration.setMessageSizeLimit(16 * 1024).setSendTimeLimit(10_000).setSendBufferSizeLimit(512 * 1024);
        // Every open socket is tracked so the server can end it when its session or access token stops being valid.
        registration.addDecoratorFactory(delegate -> new WebSocketHandlerDecorator(delegate) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                socketRegistry.register(session);
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                socketRegistry.unregister(session);
                super.afterConnectionClosed(session, status);
            }
        });
    }
}
