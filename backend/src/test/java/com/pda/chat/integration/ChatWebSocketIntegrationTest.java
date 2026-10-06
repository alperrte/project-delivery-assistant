package com.pda.chat.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.lang.reflect.Type;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Real sockets against a real server: the STOMP client connects with the PDA_ACCESS cookie exactly like the browser
 * does, REST (MockMvc, same application context and database) sends the messages.
 */
@SpringBootTest(classes = BackendApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ChatWebSocketIntegrationTest {

    private static final String ORIGIN = "http://localhost:3000";
    private static final String QUEUE = "/user/queue/chat";
    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> ORIGIN);
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        // The server re-checks open sockets quickly here so the tests do not have to wait half a minute.
        registry.add("chat.ws.session-check-millis", () -> "300");
    }

    @LocalServerPort int port;
    @Autowired MockMvc mvc;
    @Autowired SimpUserRegistry userRegistry;
    @Autowired UserAccounts users;
    @Autowired ProjectMembershipService memberships;
    @Autowired UserSessions userSessions;
    @Autowired com.pda.chat.application.service.ChatReactionService reactions;
    @Autowired com.pda.chat.application.service.ChatDelivery delivery;
    @Autowired org.springframework.transaction.support.TransactionTemplate transactions;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired tools.jackson.databind.ObjectMapper jsonMapper;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    com.pda.chat.infrastructure.repository.ChatReactionRepository reactionRepository;

    @Test void repliesAndPersonalizedReactionSnapshotsReachBothOverlapSocketsWithoutUnreadSideEffects() throws Exception {
        Fixture f=fixture();UUID group=groupId(f.manager,f.projectId);
        String sent=send(f.manager,f.projectId,group,"😀".repeat(300)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID original=UUID.fromString(JsonPath.read(sent,"$.id"));
        Socket manager=connect(f.manager), member=connect(f.member), overlap=connect(f.member), other=connect(f.otherMember), outsider=connect(f.outsider);
        for(Socket socket:List.of(manager,member,overlap,other,outsider))socket.subscribeToOwnQueue();
        String reply=postJson(f.member,messagesUrl(f.projectId,group),"{\"content\":\""+"😂".repeat(2000)+"\",\"replyToMessageId\":\""+original+"\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID message=UUID.fromString(JsonPath.read(reply,"$.id"));
        for(Socket socket:List.of(manager,member,overlap,other)) {
            var event=socket.next();var data=asMap(event.get("message"));
            assertEquals("MESSAGE",event.get("type"));assertEquals(original.toString(),asMap(data.get("replyTo")).get("id"));
            assertTrue(jsonMapper.writeValueAsBytes(event).length<16*1024);
        }
        org.mockito.Mockito.clearInvocations(reactionRepository);
        reaction(f.member,f.projectId,group,message,"THUMBS_UP",true).andExpect(status().isOk());
        for(Socket socket:List.of(manager,member,overlap,other)) {
            var event=socket.next();assertEquals("REACTIONS",event.get("type"));assertEquals("1",event.get("reactionVersion"));
            var chip=asMap(((List<?>)event.get("reactions")).getFirst());
            assertEquals(1L,((Number)chip.get("count")).longValue());
            assertEquals(socket==member||socket==overlap,chip.get("reactedByCurrentUser"));
            assertFalse(event.containsKey("message"));assertFalse(event.toString().contains("@example.test"));
        }
        org.mockito.Mockito.verify(reactionRepository,org.mockito.Mockito.times(1)).snapshots(
                org.mockito.ArgumentMatchers.eq(group),org.mockito.ArgumentMatchers.eq(List.of(message)),
                org.mockito.ArgumentMatchers.argThat(viewers->viewers.size()==3));
        reaction(f.member,f.projectId,group,message,"THUMBS_UP",true).andExpect(status().isOk());
        assertNull(manager.events.poll(150,TimeUnit.MILLISECONDS));
        reaction(f.member,f.projectId,group,message,"THUMBS_UP",false).andExpect(status().isOk());
        for(Socket socket:List.of(manager,member,overlap,other)) {var event=socket.next();assertEquals("2",event.get("reactionVersion"));assertEquals(List.of(),event.get("reactions"));}
        // A delayed callback for version 1 publishes the current, internally consistent version 2.
        delivery.reactionsChanged(new com.pda.chat.application.service.ChatDelivery.ChatReactionsChanged(f.projectId,group,
                com.pda.chat.domain.enums.ChatConversationType.PROJECT,Set.of(),message,1));
        for(Socket socket:List.of(manager,member,overlap,other)){var event=socket.next();assertEquals("2",event.get("reactionVersion"));assertEquals(List.of(),event.get("reactions"));}
        assertNull(outsider.events.poll(100,TimeUnit.MILLISECONDS));
        assertEquals(2,jdbc.queryForObject("select count(*) from chat_messages where conversation_id=?",Integer.class,group));
        mvc.perform(get(base(f.projectId)+"/conversations").cookie(f.manager.access())).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.group.unread").value(1));
    }

    @Test void rollbackAndRemovedRecipientsNeverReceiveReactionDataAndDirectScopeStaysPrivate() throws Exception {
        Fixture f=fixture();UUID direct=openDirect(f.manager,f.projectId,f.member.id());
        String body=send(f.manager,f.projectId,direct,"private").andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID message=UUID.fromString(JsonPath.read(body,"$.id"));
        Socket manager=connect(f.manager), member=connect(f.member), bystander=connect(f.otherMember);
        for(Socket socket:List.of(manager,member,bystander))socket.subscribeToOwnQueue();
        transactions.executeWithoutResult(status->{reactions.put(f.member.id(),f.projectId,direct,message,"HEART");status.setRollbackOnly();});
        assertNull(manager.events.poll(150,TimeUnit.MILLISECONDS));assertNull(member.events.poll(100,TimeUnit.MILLISECONDS));
        assertEquals(0L,jdbc.queryForObject("select reaction_version from chat_messages where id=?",Long.class,message));
        reaction(f.member,f.projectId,direct,message,"HEART",true).andExpect(status().isOk());
        assertEquals("REACTIONS",manager.next().get("type"));assertEquals("REACTIONS",member.next().get("type"));
        assertNull(bystander.events.poll(100,TimeUnit.MILLISECONDS));
        memberships.removeMember(f.manager.id(),f.projectId,f.member.id());
        reaction(f.manager,f.projectId,direct,message,"LAUGH",true).andExpect(status().isOk());
        assertEquals("REACTIONS",manager.next().get("type"));assertNull(member.events.poll(150,TimeUnit.MILLISECONDS));
        assertNull(bystander.events.poll(100,TimeUnit.MILLISECONDS));
    }

    private ResultActions reaction(Account actor,UUID project,UUID conversation,UUID message,String code,boolean add) throws Exception {
        String url=messagesUrl(project,conversation)+"/"+message+"/reactions/"+code;
        Cookie csrf=csrfCookie();var req=add?put(url):delete(url);
        return mvc.perform(req.cookie(csrf,actor.access()).header("X-XSRF-TOKEN",csrf.getValue()));
    }

    private final List<Socket> sockets = new ArrayList<>();
    private final ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();

    @BeforeEach
    void startScheduler() {
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("test-stomp-");
        scheduler.initialize();
    }

    @AfterEach
    void closeSockets() {
        sockets.forEach(socket -> {
            if (socket.session.isConnected()) {
                socket.session.disconnect();
            }
        });
        sockets.clear();
        scheduler.shutdown();
    }

    // ---- connection ---------------------------------------------------------------------------------------------

    @Test
    void anAuthenticatedUserConnectsAndMayListenToTheirOwnQueue() throws Exception {
        Fixture f = fixture();

        Socket socket = connect(f.member);
        socket.subscribeToOwnQueue();

        assertTrue(socket.session.isConnected());
    }

    @Test
    void aHandshakeWithoutAValidSessionIsRejected() throws Exception {
        Fixture f = fixture();

        // No cookie at all.
        assertHandshakeRejected(new WebSocketHttpHeaders() {{ setOrigin(ORIGIN); }});
        // A cookie that is not a valid access token.
        assertHandshakeRejected(new WebSocketHttpHeaders() {{
            setOrigin(ORIGIN);
            add(HttpHeaders.COOKIE, "PDA_ACCESS=not.a.jwt");
        }});
        // A valid session from a foreign web origin is refused too (cross-site WebSocket hijacking).
        assertHandshakeRejected(new WebSocketHttpHeaders() {{
            setOrigin("http://evil.example");
            add(HttpHeaders.COOKIE, "PDA_ACCESS=" + f.member.access().getValue());
        }});
    }

    // ---- subscription and frames --------------------------------------------------------------------------------

    @Test
    void subscribingAnywhereButTheOwnUserQueueIsRefused() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);
        List<String> forbidden = List.of(
                "/topic/chat", "/topic/conversations/" + group, "/queue/chat",
                "/user/" + f.manager.id() + "/queue/chat", "/user/queue/other", "/user/queue/chat/extra",
                "/queue/chat-user" + f.manager.id());

        for (String destination : forbidden) {
            Socket socket = connect(f.member);
            socket.session.subscribe(destination, socket.silentHandler());
            StompHeaders error = socket.errors.poll(5, TimeUnit.SECONDS);
            assertNotNull(error, "no ERROR frame for " + destination);
            assertEquals("Subscription not allowed", error.getFirst("message"), destination);
        }
    }

    @Test
    void aClientCannotSendFramesSoNothingCanCarryASpoofedSender() throws Exception {
        Fixture f = fixture();
        Socket victim = connect(f.manager);
        victim.subscribeToOwnQueue();
        String forged = "{\"senderUserId\":\"" + f.manager.id() + "\",\"content\":\"hi\"}";

        // Every refused frame ends that session, so each attempt gets its own connection.
        for (String destination : List.of("/app/chat", "/user/" + f.manager.id() + "/queue/chat", "/queue/chat",
                "/topic/chat")) {
            Socket attacker = connect(f.member);
            attacker.session.send(destination, forged);
            StompHeaders error = attacker.errors.poll(5, TimeUnit.SECONDS);
            assertNotNull(error, "no ERROR frame for a SEND to " + destination);
            assertEquals("Frame not allowed", error.getFirst("message"), destination);
        }
        assertNull(victim.events.poll(1, TimeUnit.SECONDS), "a forged frame reached somebody");
    }

    // ---- delivery -----------------------------------------------------------------------------------------------

    @Test
    void aDirectMessageReachesItsTwoParticipantsAndNobodyElse() throws Exception {
        Fixture f = fixture();
        UUID direct = openDirect(f.manager, f.projectId, f.member.id());
        Socket manager = connect(f.manager);
        Socket member = connect(f.member);
        Socket bystander = connect(f.otherMember);
        Socket outsider = connect(f.outsider);
        for (Socket socket : List.of(manager, member, bystander, outsider)) {
            socket.subscribeToOwnQueue();
        }

        send(f.manager, f.projectId, direct, "Sadece sana").andExpect(status().isCreated());

        Map<String, Object> received = member.next();
        assertEquals("MESSAGE", received.get("type"));
        assertEquals(f.projectId.toString(), received.get("projectId"));
        assertEquals(direct.toString(), received.get("conversationId"));
        assertEquals("DIRECT", received.get("conversationType"));
        Map<String, Object> message = asMap(received.get("message"));
        assertEquals("Sadece sana", message.get("content"));
        assertNotNull(message.get("id"));
        assertNotNull(message.get("createdAt"));
        assertEquals(f.manager.id().toString(), asMap(message.get("sender")).get("userId"));
        assertFalse(received.toString().contains("@example.test"), "an event leaks an email");
        // The sender's other tabs get it too (they dedupe by message id).
        assertEquals(message.get("id"), asMap(manager.next().get("message")).get("id"));
        // A project member who is not a participant, and somebody outside the project, hear nothing.
        assertNull(bystander.events.poll(1, TimeUnit.SECONDS));
        assertNull(outsider.events.poll(100, TimeUnit.MILLISECONDS));
    }

    @Test
    void aGroupMessageReachesEveryMemberAndOnlyMembersWithTheAuthenticatedSender() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.manager, f.projectId);
        Socket manager = connect(f.manager);
        Socket member = connect(f.member);
        Socket other = connect(f.otherMember);
        Socket outsider = connect(f.outsider);
        for (Socket socket : List.of(manager, member, other, outsider)) {
            socket.subscribeToOwnQueue();
        }

        // The body tries to pose as the manager; the event must still name the authenticated sender.
        postJson(f.member, messagesUrl(f.projectId, group),
                "{\"content\":\"Herkese\",\"senderUserId\":\"" + f.manager.id() + "\"}")
                .andExpect(status().isCreated());

        for (Socket socket : List.of(manager, member, other)) {
            Map<String, Object> received = socket.next();
            assertEquals("PROJECT", received.get("conversationType"));
            assertEquals(group.toString(), received.get("conversationId"));
            Map<String, Object> message = asMap(received.get("message"));
            assertEquals("Herkese", message.get("content"));
            assertEquals(f.member.id().toString(), asMap(message.get("sender")).get("userId"));
        }
        assertNull(outsider.events.poll(1, TimeUnit.SECONDS), "a non-member received a project message");
    }

    @Test
    void aMemberRemovedWhileConnectedReceivesNothingMore() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.manager, f.projectId);
        Socket member = connect(f.member);
        Socket other = connect(f.otherMember);
        member.subscribeToOwnQueue();
        other.subscribeToOwnQueue();

        send(f.manager, f.projectId, group, "once").andExpect(status().isCreated());
        member.next();
        other.next();

        memberships.removeMember(f.manager.id(), f.projectId, f.member.id());
        send(f.manager, f.projectId, group, "sonra").andExpect(status().isCreated());

        assertEquals("sonra", asMap(other.next().get("message")).get("content"));
        assertNull(member.events.poll(1, TimeUnit.SECONDS), "a removed member still receives pushes");
    }

    @Test
    void markingReadSyncsOnlyTheReadersOwnSessions() throws Exception {
        Fixture f = fixture();
        UUID direct = openDirect(f.manager, f.projectId, f.member.id());
        Socket memberTab = connect(f.member);
        Socket manager = connect(f.manager);
        memberTab.subscribeToOwnQueue();
        manager.subscribeToOwnQueue();

        postReq(f.member, base(f.projectId) + "/conversations/" + direct + "/read", null)
                .andExpect(status().isNoContent());

        Map<String, Object> read = memberTab.next();
        assertEquals("READ", read.get("type"));
        assertEquals(direct.toString(), read.get("conversationId"));
        assertEquals(f.projectId.toString(), read.get("projectId"));
        assertFalse(read.containsKey("message"));
        assertNull(manager.events.poll(1, TimeUnit.SECONDS));
    }

    // ---- sockets end with their session -------------------------------------------------------------------------

    @Test
    void aSocketIsClosedByTheServerOnceItsSessionIsRevokedAndOtherPeopleAreUntouched() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.manager, f.projectId);
        Socket leaving = connect(f.member);
        Socket staying = connect(f.otherMember);
        leaving.subscribeToOwnQueue();
        staying.subscribeToOwnQueue();
        send(f.manager, f.projectId, group, "before").andExpect(status().isCreated());
        leaving.next();
        staying.next();

        // The member's session ends (logout everywhere, an admin disabling the account, ...).
        userSessions.revokeAll(f.member.id(), java.time.Instant.now());

        awaitClosed(leaving);
        // Nothing sent from now on reaches the closed socket, and the others keep working.
        send(f.manager, f.projectId, group, "after").andExpect(status().isCreated());
        assertEquals("after", asMap(staying.next().get("message")).get("content"));
        assertTrue(staying.session.isConnected());
        assertNull(leaving.events.poll(500, TimeUnit.MILLISECONDS), "a socket of a revoked session still receives pushes");
        // The revoked cookie cannot open a new socket either.
        assertHandshakeRejected(new WebSocketHttpHeaders() {{
            setOrigin(ORIGIN);
            add(HttpHeaders.COOKIE, "PDA_ACCESS=" + f.member.access().getValue());
        }});
    }

    @Test
    void aSocketOfAValidSessionStaysOpenAcrossSeveralChecksAndKeepsReceiving() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.manager, f.projectId);
        Socket member = connect(f.member);
        member.subscribeToOwnQueue();

        // Several 300 ms checks pass; a valid session is never touched.
        Thread.sleep(1500);
        assertTrue(member.session.isConnected());
        send(f.manager, f.projectId, group, "still here").andExpect(status().isCreated());

        assertEquals("still here", asMap(member.next().get("message")).get("content"));
    }

    @Test
    void endingOneSessionLeavesTheOtherSessionOfTheSameAccountConnected() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.manager, f.projectId);
        // Two logins (two sessions) of the same account, each with its own socket.
        Account second = login(f.member);
        Socket firstTab = connect(f.member);
        Socket secondTab = connect(second);
        firstTab.subscribeToOwnQueue();
        secondTab.subscribeToOwnQueue();

        // Only the second session is ended.
        assertTrue(userSessions.revokeById(f.member.id(), sessionOf(second), java.time.Instant.now()));

        awaitClosed(secondTab);
        assertTrue(firstTab.session.isConnected(), "the other session of the account must stay connected");
        send(f.manager, f.projectId, group, "hello").andExpect(status().isCreated());
        assertEquals("hello", asMap(firstTab.next().get("message")).get("content"));
    }

    // ---- STOMP client -------------------------------------------------------------------------------------------

    private final class Socket {
        final StompSession session;
        final BlockingQueue<Map<String, Object>> events = new LinkedBlockingQueue<>();
        final BlockingQueue<StompHeaders> errors = new LinkedBlockingQueue<>();

        final UUID userId;

        Socket(StompSession session, UUID userId) {
            this.session = session;
            this.userId = userId;
        }

        /** Subscribes and waits until the server's user registry shows the subscription, so nothing is missed. */
        void subscribeToOwnQueue() throws Exception {
            session.subscribe(QUEUE, new StompFrameHandler() {
                @Override
                public Type getPayloadType(StompHeaders headers) {
                    return Map.class;
                }

                @Override
                @SuppressWarnings("unchecked")
                public void handleFrame(StompHeaders headers, Object payload) {
                    events.add((Map<String, Object>) payload);
                }
            });
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (System.nanoTime() < deadline) {
                SimpUser user = userRegistry.getUser(userId.toString());
                if (user != null && user.getSessions().stream().anyMatch(s -> !s.getSubscriptions().isEmpty())) {
                    return;
                }
                Thread.sleep(20);
            }
            throw new AssertionError("subscription never reached the server");
        }

        StompFrameHandler silentHandler() {
            return new StompFrameHandler() {
                @Override
                public Type getPayloadType(StompHeaders headers) {
                    return Map.class;
                }

                @Override
                public void handleFrame(StompHeaders headers, Object payload) {
                    // Nothing should ever arrive here.
                }
            };
        }

        Map<String, Object> next() throws InterruptedException {
            Map<String, Object> event = events.poll(5, TimeUnit.SECONDS);
            assertNotNull(event, "no event arrived");
            return event;
        }
    }

    private Socket connect(Account account) throws Exception {
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.setOrigin(ORIGIN);
        headers.add(HttpHeaders.COOKIE, "PDA_ACCESS=" + account.access().getValue());
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new JacksonJsonMessageConverter());
        client.setTaskScheduler(scheduler);
        Socket[] holder = new Socket[1];
        StompSession session = client.connectAsync(url(), headers, new StompHeaders(), new StompSessionHandlerAdapter() {
            @Override
            public void handleFrame(StompHeaders frameHeaders, Object payload) {
                // ERROR frames end up here.
                holder[0].errors.add(frameHeaders);
            }

            @Override
            public Type getPayloadType(StompHeaders frameHeaders) {
                return byte[].class;
            }
        }).get(10, TimeUnit.SECONDS);
        // The error queue must exist before the first frame can fail, so it is created lazily on first use.
        holder[0] = new Socket(session, account.id());
        sockets.add(holder[0]);
        return holder[0];
    }

    /** Waits until the server has closed the socket (it notices at its next session check). */
    private static void awaitClosed(Socket socket) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (socket.session.isConnected() && System.nanoTime() < deadline) {
            Thread.sleep(50);
        }
        assertFalse(socket.session.isConnected(), "the server did not close the socket of an ended session");
    }

    /** A second, independent login (a new session) of the same account. */
    private Account login(Account existing) throws Exception {
        Cookie csrf = csrfCookie();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        var login = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .with(request -> { request.setRemoteAddr("test-" + suffix); return request; })
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + existing.email() + "\",\"password\":\"" + existing.password() + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        return new Account(existing.id(), cookie(login.getHeaders(HttpHeaders.SET_COOKIE), "PDA_ACCESS"),
                existing.email(), existing.password());
    }

    /** The session id carried by an access token (its "sid" claim). */
    private static UUID sessionOf(Account account) {
        String payload = new String(Base64.getUrlDecoder().decode(account.access().getValue().split("[.]")[1]),
                java.nio.charset.StandardCharsets.UTF_8);
        return UUID.fromString(JsonPath.read(payload, "$.sid"));
    }

    private void assertHandshakeRejected(WebSocketHttpHeaders headers) {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        assertThrows(ExecutionException.class, () -> client.connectAsync(url(), headers, new StompHeaders(),
                new StompSessionHandlerAdapter() { }).get(10, TimeUnit.SECONDS));
    }

    private String url() {
        return "ws://localhost:" + port + "/api/v1/ws";
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        return (Map<String, Object>) value;
    }

    // ---- REST helpers (same shape as ChatApiIntegrationTest) ----------------------------------------------------

    private record Fixture(UUID projectId, Account manager, Account member, Account otherMember, Account outsider) {
    }

    private Fixture fixture() throws Exception {
        Account manager = account("wsmanager");
        Account member = account("wsmember");
        Account otherMember = account("wsother");
        Account outsider = account("wsoutsider");
        UUID projectId = createProject(manager, "Socket project");
        memberships.addMember(manager.id(), projectId, member.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));
        memberships.addMember(manager.id(), projectId, otherMember.id(), Set.of(ProjectRole.TESTER));
        return new Fixture(projectId, manager, member, otherMember, outsider);
    }

    private static String base(UUID projectId) {
        return "/api/v1/projects/" + projectId + "/chat";
    }

    private static String messagesUrl(UUID projectId, UUID conversationId) {
        return base(projectId) + "/conversations/" + conversationId + "/messages";
    }

    private UUID groupId(Account actor, UUID projectId) throws Exception {
        String body = mvc.perform(get(base(projectId) + "/conversations").cookie(actor.access()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.group.id"));
    }

    private UUID openDirect(Account actor, UUID projectId, UUID target) throws Exception {
        String body = postReq(actor, base(projectId) + "/direct/" + target, null)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    private ResultActions send(Account actor, UUID projectId, UUID conversationId, String content) throws Exception {
        return postJson(actor, messagesUrl(projectId, conversationId),
                "{\"content\":\"" + content.replace("\"", "\\\"") + "\"}");
    }

    private ResultActions postJson(Account actor, String url, String json) throws Exception {
        return postReq(actor, url, json);
    }

    private ResultActions postReq(Account actor, String url, String json) throws Exception {
        Cookie csrf = csrfCookie();
        var request = post(url).cookie(csrf, actor.access()).header("X-XSRF-TOKEN", csrf.getValue());
        return mvc.perform(json == null ? request : request.contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private UUID createProject(Account actor, String name) throws Exception {
        Cookie csrf = csrfCookie();
        var response = mvc.perform(post("/api/v1/projects").cookie(csrf, actor.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        return UUID.fromString(JsonPath.read(response.getContentAsString(), "$.id"));
    }

    private Account account(String prefix) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String email = prefix + suffix + "@example.test";
        String password = UUID.randomUUID().toString();
        UUID id = users.registerLocal(email, "u" + suffix, password);
        Cookie csrf = csrfCookie();
        var login = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .with(request -> { request.setRemoteAddr("test-" + suffix); return request; })
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie access = cookie(login.getHeaders(HttpHeaders.SET_COOKIE), "PDA_ACCESS");
        assertFalse(access.getValue().isBlank());
        return new Account(id, access, email, password);
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private static Cookie cookie(java.util.Collection<String> headers, String name) {
        String value = headers.stream().filter(header -> header.startsWith(name + "="))
                .findFirst().orElseThrow().split(";", 2)[0].substring(name.length() + 1);
        return new Cookie(name, value);
    }

    private record Account(UUID id, Cookie access, String email, String password) {
    }
}
