package com.pda.chat.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.chat.application.service.ChatService;
import com.pda.chat.domain.entity.ChatConversation;
import com.pda.chat.domain.enums.ChatConversationType;
import com.pda.chat.infrastructure.repository.ChatConversationRepository;
import com.pda.chat.infrastructure.repository.ChatMessageRepository;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ChatApiIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired ProjectMembershipService memberships;
    @Autowired ChatService chat;
    @Autowired ChatConversationRepository conversationRepository;
    @Autowired ChatMessageRepository messageRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired org.springframework.transaction.support.TransactionTemplate transactions;

    // ---- membership ---------------------------------------------------------------------------------------------

    @Test
    void projectMemberOpensTheChatAndANonMemberCannot() throws Exception {
        Fixture f = fixture();

        mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.member.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.group.type").value("PROJECT"))
                .andExpect(jsonPath("$.group.id").isNotEmpty())
                .andExpect(jsonPath("$.group.unread").value(0))
                .andExpect(jsonPath("$.totalUnread").value(0));
        mvc.perform(get(base(f.projectId) + "/members").cookie(f.member.access())).andExpect(status().isOk());

        for (Account outsider : List.of(f.outsider, f.foreignManager)) {
            mvc.perform(get(base(f.projectId) + "/conversations").cookie(outsider.access()))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("CHAT_FORBIDDEN"));
            mvc.perform(get(base(f.projectId) + "/members").cookie(outsider.access()))
                    .andExpect(status().isForbidden());
            mvc.perform(postReq(outsider, base(f.projectId) + "/direct/" + f.member.id(), null))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void anonymousCallsAreUnauthorizedAndTheMemberListNeverContainsEmailsOrYourself() throws Exception {
        Fixture f = fixture();

        mvc.perform(get(base(f.projectId) + "/conversations")).andExpect(status().isUnauthorized());
        mvc.perform(get(base(f.projectId) + "/members")).andExpect(status().isUnauthorized());

        String members = mvc.perform(get(base(f.projectId) + "/members").cookie(f.member.access()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<String> ids = JsonPath.read(members, "$[*].userId");
        assertEquals(Set.of(f.manager.id().toString(), f.otherMember.id().toString()), Set.copyOf(ids));
        assertFalse(ids.contains(f.member.id().toString()), "the caller is not offered themselves");
        assertNoEmail(members);
    }

    @Test
    void writesRequireCsrf() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);

        mvc.perform(post(base(f.projectId) + "/conversations/" + group + "/messages").cookie(f.member.access())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"hi\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(base(f.projectId) + "/conversations/" + group + "/read").cookie(f.member.access()))
                .andExpect(status().isForbidden());
        mvc.perform(post(base(f.projectId) + "/direct/" + f.manager.id()).cookie(f.member.access()))
                .andExpect(status().isForbidden());
        assertEquals(0, history(f.member, f.projectId, group).size());
    }

    // ---- project group ------------------------------------------------------------------------------------------

    @Test
    void everyMemberSharesTheOneProjectGroupAndSeesItsMessages() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.manager, f.projectId);

        assertEquals(group, groupId(f.member, f.projectId));
        assertEquals(group, groupId(f.otherMember, f.projectId));
        send(f.manager, f.projectId, group, "Merhaba ekip").andExpect(status().isCreated());

        for (Account reader : List.of(f.manager, f.member, f.otherMember)) {
            assertEquals(List.of("Merhaba ekip"), contents(historyPage(reader, f.projectId, group)));
        }
        mvc.perform(get(messagesUrl(f.projectId, group)).cookie(f.outsider.access()))
                .andExpect(status().isForbidden());
    }

    @Test
    void concurrentFirstUseCreatesExactlyOneProjectGroup() throws Exception {
        Fixture f = fixture();

        List<UUID> seen = runConcurrently(8, () -> chat.overview(f.member.id(), f.projectId).group().id());

        assertEquals(1, Set.copyOf(seen).size());
        long groups = conversationRepository.findAll().stream()
                .filter(c -> c.getProjectId().equals(f.projectId) && c.getType() == ChatConversationType.PROJECT)
                .count();
        assertEquals(1, groups);
    }

    // ---- direct conversations -----------------------------------------------------------------------------------

    @Test
    void sameProjectMembersOpenTheSameDirectConversationFromBothSides() throws Exception {
        Fixture f = fixture();

        UUID fromMember = openDirect(f.member, f.projectId, f.otherMember.id());
        UUID fromOther = openDirect(f.otherMember, f.projectId, f.member.id());
        UUID again = openDirect(f.member, f.projectId, f.otherMember.id());

        assertEquals(fromMember, fromOther);
        assertEquals(fromMember, again);
        mvc.perform(postReq(f.member, base(f.projectId) + "/direct/" + f.otherMember.id(), null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("DIRECT"))
                .andExpect(jsonPath("$.peer.userId").value(f.otherMember.id().toString()))
                .andExpect(jsonPath("$.peer.nickname").isNotEmpty());
        // The member list tells the client which person already has a conversation.
        String members = mvc.perform(get(base(f.projectId) + "/members").cookie(f.member.access()))
                .andReturn().getResponse().getContentAsString();
        assertEquals(fromMember.toString(),
                JsonPath.<List<String>>read(members, "$[?(@.userId=='" + f.otherMember.id() + "')].conversationId")
                        .get(0));
    }

    @Test
    void concurrentOpensOfOneDirectConversationProduceOneRow() throws Exception {
        Fixture f = fixture();

        List<UUID> aToB = runConcurrently(6, () -> chat.openDirect(f.member.id(), f.projectId, f.otherMember.id()).id());
        List<UUID> bToA = runConcurrently(6, () -> chat.openDirect(f.otherMember.id(), f.projectId, f.member.id()).id());

        assertEquals(1, Set.copyOf(aToB).size());
        assertEquals(aToB.get(0), bToA.get(0));
        assertEquals(1, conversationRepository.findDirectsOf(f.projectId, f.member.id()).size());
    }

    @Test
    void theSamePairHasSeparateConversationsInDifferentProjects() throws Exception {
        Fixture f = fixture();
        UUID secondProject = createProject(f.manager, "Second project");
        memberships.addMember(f.manager.id(), secondProject, f.member.id(), Set.of(ProjectRole.TESTER));

        UUID first = openDirect(f.manager, f.projectId, f.member.id());
        UUID second = openDirect(f.manager, secondProject, f.member.id());

        assertTrue(!first.equals(second));
        // A conversation of project one is not reachable through project two's path.
        mvc.perform(get(messagesUrl(secondProject, first)).cookie(f.manager.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void selfChatAndCrossProjectOrUnknownRecipientsAreRejected() throws Exception {
        Fixture f = fixture();

        mvc.perform(postReq(f.member, base(f.projectId) + "/direct/" + f.member.id(), null))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CHAT_SELF"));
        // Member of another project only: no shared project, no chat.
        mvc.perform(postReq(f.member, base(f.projectId) + "/direct/" + f.foreignManager.id(), null))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CHAT_RECIPIENT"));
        mvc.perform(postReq(f.member, base(f.projectId) + "/direct/" + f.outsider.id(), null))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CHAT_RECIPIENT"));
        mvc.perform(postReq(f.member, base(f.projectId) + "/direct/" + UUID.randomUUID(), null))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CHAT_RECIPIENT"));
        mvc.perform(postReq(f.member, base(f.projectId) + "/direct/not-a-uuid", null))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CHAT_INVALID_REQUEST"));
        assertEquals(0, conversationRepository.findDirectsOf(f.projectId, f.member.id()).size());
    }

    @Test
    void theCanonicalPairOrderSatisfiesTheDatabaseCheckForAnyIds() throws Exception {
        UUID project = createProject(account("chatorder"), "Order project");
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 200; i++) {
            UUID a = new UUID(random.nextLong(), random.nextLong());
            UUID b = new UUID(random.nextLong(), random.nextLong());
            ChatConversation conversation = ChatConversation.direct(project, a, b, Instant.now());
            int inserted = transactions.execute(status -> conversationRepository.insertDirectIfAbsent(
                    conversation.getId(), project, conversation.getDirectUserLow(), conversation.getDirectUserHigh(),
                    conversation.getCreatedAt()));
            assertEquals(1, inserted, "pair " + a + " / " + b);
        }
    }

    // ---- authorization of conversations -------------------------------------------------------------------------

    @Test
    void aDirectConversationIsPrivateToItsTwoParticipants() throws Exception {
        Fixture f = fixture();
        UUID direct = openDirect(f.member, f.projectId, f.otherMember.id());
        send(f.member, f.projectId, direct, "Sadece ikimiz").andExpect(status().isCreated());

        // The manager is a project member but not a participant: 404, exactly like a conversation that is not there.
        mvc.perform(get(messagesUrl(f.projectId, direct)).cookie(f.manager.access()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CHAT_NOT_FOUND"));
        mvc.perform(get(messagesUrl(f.projectId, UUID.randomUUID())).cookie(f.manager.access()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CHAT_NOT_FOUND"));
        send(f.manager, f.projectId, direct, "Araya gireyim").andExpect(status().isNotFound());
        mvc.perform(postReq(f.manager, base(f.projectId) + "/conversations/" + direct + "/read", null))
                .andExpect(status().isNotFound());
        assertEquals(List.of("Sadece ikimiz"), contents(historyPage(f.otherMember, f.projectId, direct)));
        // And it never shows up in the manager's overview.
        mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.manager.access()))
                .andExpect(jsonPath("$.directs.length()").value(0));
    }

    @Test
    void aConversationIdOfAnotherProjectIsNotReachableEvenForAMemberOfBoth() throws Exception {
        Fixture f = fixture();
        UUID otherProject = createProject(f.member, "Member's own project");
        UUID foreignGroup = groupId(f.member, otherProject);
        UUID ownGroup = groupId(f.member, f.projectId);

        mvc.perform(get(messagesUrl(f.projectId, foreignGroup)).cookie(f.member.access()))
                .andExpect(status().isNotFound());
        send(f.member, f.projectId, foreignGroup, "yanlis proje").andExpect(status().isNotFound());
        mvc.perform(postReq(f.member, base(f.projectId) + "/conversations/" + foreignGroup + "/read", null))
                .andExpect(status().isNotFound());
        assertEquals(0, history(f.member, otherProject, foreignGroup).size());
        assertEquals(0, history(f.member, f.projectId, ownGroup).size());
    }

    @Test
    void aMemberRemovedFromTheProjectLosesHistorySendingAndTheOverviewAtOnce() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);
        UUID direct = openDirect(f.member, f.projectId, f.otherMember.id());
        send(f.member, f.projectId, group, "bir").andExpect(status().isCreated());
        send(f.member, f.projectId, direct, "iki").andExpect(status().isCreated());

        memberships.removeMember(f.manager.id(), f.projectId, f.member.id());

        mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.member.access()))
                .andExpect(status().isForbidden());
        mvc.perform(get(messagesUrl(f.projectId, group)).cookie(f.member.access())).andExpect(status().isForbidden());
        mvc.perform(get(messagesUrl(f.projectId, direct)).cookie(f.member.access())).andExpect(status().isForbidden());
        send(f.member, f.projectId, group, "hala buradayim").andExpect(status().isForbidden());
        send(f.member, f.projectId, direct, "hala buradayim").andExpect(status().isForbidden());
        // Rows stay for everyone else: the history is intact.
        assertEquals(List.of("bir"), contents(historyPage(f.manager, f.projectId, group)));
        assertEquals(1, messageRepository.findLatest(group, 10).size());
        assertEquals(1, messageRepository.findLatest(direct, 10).size());
    }

    @Test
    void aDirectConversationWithSomeoneWhoLeftIsNoLongerOfferedOrWritable() throws Exception {
        Fixture f = fixture();
        UUID direct = openDirect(f.member, f.projectId, f.otherMember.id());
        send(f.otherMember, f.projectId, direct, "gidiyorum").andExpect(status().isCreated());

        memberships.removeMember(f.manager.id(), f.projectId, f.otherMember.id());

        mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.member.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.directs.length()").value(0))
                .andExpect(jsonPath("$.totalUnread").value(0));
        send(f.member, f.projectId, direct, "orada misin").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CHAT_RECIPIENT"));
        mvc.perform(postReq(f.member, base(f.projectId) + "/direct/" + f.otherMember.id(), null))
                .andExpect(status().isNotFound());
    }

    // ---- sending ------------------------------------------------------------------------------------------------

    @Test
    void aValidMessageIsStoredAndReturnedWithTheAuthenticatedSender() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);

        send(f.member, f.projectId, group, "  Merhaba\r\nDunya  ")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.conversationId").value(group.toString()))
                .andExpect(jsonPath("$.content").value("Merhaba\nDunya"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.sender.userId").value(f.member.id().toString()))
                .andExpect(jsonPath("$.sender.nickname").isNotEmpty());

        assertEquals(List.of("Merhaba\nDunya"), contents(historyPage(f.manager, f.projectId, group)));
    }

    @Test
    void blankTooLongAndControlCharacterMessagesAreRejectedWithCodes() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);

        send(f.member, f.projectId, group, "   \n ").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CHAT_MESSAGE_EMPTY"));
        postJson(f.member, messagesUrl(f.projectId, group), "{}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CHAT_MESSAGE_EMPTY"));
        postJson(f.member, messagesUrl(f.projectId, group), "{\"content\":null}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CHAT_MESSAGE_EMPTY"));
        send(f.member, f.projectId, group, "x".repeat(2001)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CHAT_MESSAGE_TOO_LONG"));
        postJson(f.member, messagesUrl(f.projectId, group), "{\"content\":\"a\\u0000b\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CHAT_MESSAGE_INVALID"));
        postJson(f.member, messagesUrl(f.projectId, group), "not json").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CHAT_INVALID_REQUEST"));
        send(f.member, f.projectId, group, "x".repeat(2000)).andExpect(status().isCreated());

        assertEquals(1, history(f.member, f.projectId, group).size());
    }

    @Test
    void aSenderFieldInTheBodyIsIgnoredSoTheSenderCannotBeSpoofed() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);

        postJson(f.member, messagesUrl(f.projectId, group),
                "{\"content\":\"ben manager degilim\",\"senderUserId\":\"" + f.manager.id() + "\",\"sender\":{\"userId\":\""
                        + f.manager.id() + "\"},\"conversationId\":\"" + UUID.randomUUID() + "\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sender.userId").value(f.member.id().toString()))
                .andExpect(jsonPath("$.conversationId").value(group.toString()));

        String stored = mvc.perform(get(messagesUrl(f.projectId, group)).cookie(f.manager.access()))
                .andReturn().getResponse().getContentAsString();
        assertEquals(f.member.id().toString(), JsonPath.read(stored, "$.messages[0].sender.userId"));
    }

    @Test
    void sendingIsRateLimitedPerUser() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);

        for (int i = 0; i < 30; i++) {
            send(f.member, f.projectId, group, "mesaj " + i).andExpect(status().isCreated());
        }
        send(f.member, f.projectId, group, "otuzbirinci").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("CHAT_RATE_LIMITED"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Retry-After", "60"));
        // Someone else is not affected by it.
        send(f.manager, f.projectId, group, "ben yazabiliyorum").andExpect(status().isCreated());
        assertEquals(31, history(f.manager, f.projectId, group, 100).size());
    }

    @Test
    void refusedMessagesCountTowardsTheSendLimitToo() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);
        String tooLong = "x".repeat(2001);

        // Within the limit every refusal keeps its normal answer ...
        for (int i = 0; i < 10; i++) {
            send(f.member, f.projectId, group, "   ").andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("CHAT_MESSAGE_EMPTY"));
            send(f.member, f.projectId, group, tooLong).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("CHAT_MESSAGE_TOO_LONG"));
        }
        for (int i = 0; i < 10; i++) {
            send(f.member, f.projectId, group, "geçerli " + i).andExpect(status().isCreated());
        }

        // ... but they used up the same 30 attempts: whatever comes next is limited, valid or not.
        send(f.member, f.projectId, group, "   ").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("CHAT_RATE_LIMITED"));
        send(f.member, f.projectId, group, "geçerli ama çok geç").andExpect(status().isTooManyRequests());
        assertEquals(10, history(f.manager, f.projectId, group, 100).size(), "only the valid messages were stored");
        // Someone else is not affected, and a refusal by the rules for them is still the normal answer.
        send(f.manager, f.projectId, group, "   ").andExpect(status().isBadRequest());
    }

    @Test
    void messageContentNeverLandsInTheEventPublicationRegistry() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);
        String secret = "gizli-" + UUID.randomUUID();

        send(f.member, f.projectId, group, secret).andExpect(status().isCreated());

        Integer leaks = jdbc.queryForObject(
                "select count(*) from event_publication where serialized_event like ?", Integer.class,
                "%" + secret + "%");
        assertEquals(0, leaks);
    }

    // ---- history and pagination ---------------------------------------------------------------------------------

    @Test
    void historyIsPagedByCursorOldestToNewest() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);
        List<UUID> ids = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            ids.add(UUID.fromString(JsonPath.read(send(f.member, f.projectId, group, "m" + i).andReturn()
                    .getResponse().getContentAsString(), "$.id")));
        }

        // Default page (30) holds everything.
        assertEquals(List.of("m1", "m2", "m3", "m4", "m5", "m6", "m7"), contents(historyPage(f.manager, f.projectId, group)));

        String newest = page(f.manager, messagesUrl(f.projectId, group) + "?limit=3");
        assertEquals(List.of("m5", "m6", "m7"), JsonPath.read(newest, "$.messages[*].content"));
        assertEquals(true, JsonPath.read(newest, "$.hasMore"));

        String older = page(f.manager, messagesUrl(f.projectId, group) + "?limit=3&before=" + ids.get(4));
        assertEquals(List.of("m2", "m3", "m4"), JsonPath.read(older, "$.messages[*].content"));
        assertEquals(true, JsonPath.read(older, "$.hasMore"));

        String oldest = page(f.manager, messagesUrl(f.projectId, group) + "?limit=3&before=" + ids.get(1));
        assertEquals(List.of("m1"), JsonPath.read(oldest, "$.messages[*].content"));
        assertEquals(false, JsonPath.read(oldest, "$.hasMore"));

        String catchUp = page(f.manager, messagesUrl(f.projectId, group) + "?after=" + ids.get(4));
        assertEquals(List.of("m6", "m7"), JsonPath.read(catchUp, "$.messages[*].content"));
        assertEquals(false, JsonPath.read(catchUp, "$.hasMore"));

        String partial = page(f.manager, messagesUrl(f.projectId, group) + "?limit=1&after=" + ids.get(4));
        assertEquals(List.of("m6"), JsonPath.read(partial, "$.messages[*].content"));
        assertEquals(true, JsonPath.read(partial, "$.hasMore"));

        // Out of range limits are clamped, not an error.
        assertEquals(7, ((List<?>) JsonPath.read(page(f.manager, messagesUrl(f.projectId, group) + "?limit=1000"),
                "$.messages")).size());
        assertEquals(1, ((List<?>) JsonPath.read(page(f.manager, messagesUrl(f.projectId, group) + "?limit=0"),
                "$.messages")).size());
    }

    @Test
    void badCursorsAreRejected() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);
        UUID direct = openDirect(f.member, f.projectId, f.manager.id());
        UUID inGroup = UUID.fromString(JsonPath.read(send(f.member, f.projectId, group, "grup").andReturn()
                .getResponse().getContentAsString(), "$.id"));
        UUID inDirect = UUID.fromString(JsonPath.read(send(f.member, f.projectId, direct, "ozel").andReturn()
                .getResponse().getContentAsString(), "$.id"));

        mvc.perform(get(messagesUrl(f.projectId, group) + "?before=" + inGroup + "&after=" + inGroup)
                        .cookie(f.member.access()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CHAT_INVALID_REQUEST"));
        // A message id of ANOTHER conversation is not a valid cursor here (and reveals nothing about it).
        mvc.perform(get(messagesUrl(f.projectId, group) + "?before=" + inDirect).cookie(f.member.access()))
                .andExpect(status().isBadRequest());
        mvc.perform(get(messagesUrl(f.projectId, group) + "?after=" + UUID.randomUUID()).cookie(f.member.access()))
                .andExpect(status().isBadRequest());
        mvc.perform(get(messagesUrl(f.projectId, group) + "?before=oops").cookie(f.member.access()))
                .andExpect(status().isBadRequest());
    }

    // ---- unread and read state ----------------------------------------------------------------------------------

    @Test
    void unreadCountsFollowOtherPeoplesMessagesAndMarkReadClearsThem() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.manager, f.projectId);
        UUID direct = openDirect(f.manager, f.projectId, f.member.id());

        send(f.manager, f.projectId, direct, "d1").andExpect(status().isCreated());
        send(f.manager, f.projectId, direct, "d2").andExpect(status().isCreated());
        send(f.manager, f.projectId, group, "g1").andExpect(status().isCreated());
        send(f.otherMember, f.projectId, group, "g2").andExpect(status().isCreated());
        send(f.member, f.projectId, group, "benim").andExpect(status().isCreated());

        // The member: 2 direct + 2 group (their own message is never unread).
        mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.member.access()))
                .andExpect(jsonPath("$.group.unread").value(2))
                .andExpect(jsonPath("$.directs[0].unread").value(2))
                .andExpect(jsonPath("$.directs[0].peer.userId").value(f.manager.id().toString()))
                .andExpect(jsonPath("$.directs[0].lastMessage.preview").value("d2"))
                .andExpect(jsonPath("$.totalUnread").value(4));
        // The manager only has the group messages of others (g2, benim) unread; their own direct messages are not.
        mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.manager.access()))
                .andExpect(jsonPath("$.group.unread").value(2))
                .andExpect(jsonPath("$.directs[0].unread").value(0))
                .andExpect(jsonPath("$.totalUnread").value(2));

        mvc.perform(postReq(f.member, base(f.projectId) + "/conversations/" + direct + "/read", null))
                .andExpect(status().isNoContent());
        mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.member.access()))
                .andExpect(jsonPath("$.group.unread").value(2))
                .andExpect(jsonPath("$.directs[0].unread").value(0))
                .andExpect(jsonPath("$.totalUnread").value(2));
        mvc.perform(postReq(f.member, base(f.projectId) + "/conversations/" + group + "/read", null))
                .andExpect(status().isNoContent());
        // Marking read twice is harmless and a new message after it counts again.
        mvc.perform(postReq(f.member, base(f.projectId) + "/conversations/" + group + "/read", null))
                .andExpect(status().isNoContent());
        send(f.manager, f.projectId, group, "g3").andExpect(status().isCreated());
        mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.member.access()))
                .andExpect(jsonPath("$.group.unread").value(1))
                .andExpect(jsonPath("$.totalUnread").value(1));
    }

    @Test
    void unreadCountsAreScopedToTheirProject() throws Exception {
        Fixture f = fixture();
        UUID secondProject = createProject(f.manager, "Second project");
        memberships.addMember(f.manager.id(), secondProject, f.member.id(), Set.of(ProjectRole.TESTER));
        send(f.manager, f.projectId, groupId(f.manager, f.projectId), "birinci").andExpect(status().isCreated());
        send(f.manager, secondProject, groupId(f.manager, secondProject), "ikinci").andExpect(status().isCreated());
        send(f.manager, secondProject, groupId(f.manager, secondProject), "ikinci-2").andExpect(status().isCreated());

        mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.member.access()))
                .andExpect(jsonPath("$.totalUnread").value(1));
        mvc.perform(get(base(secondProject) + "/conversations").cookie(f.member.access()))
                .andExpect(jsonPath("$.totalUnread").value(2));
    }

    @Test
    void aNewMemberIsNotFloodedWithGroupHistoryAsUnread() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.manager, f.projectId);
        send(f.manager, f.projectId, group, "eski 1").andExpect(status().isCreated());
        send(f.manager, f.projectId, group, "eski 2").andExpect(status().isCreated());
        Account late = account("chatlate");

        memberships.addMember(f.manager.id(), f.projectId, late.id(), Set.of(ProjectRole.TESTER));

        mvc.perform(get(base(f.projectId) + "/conversations").cookie(late.access()))
                .andExpect(jsonPath("$.group.unread").value(0));
        send(f.manager, f.projectId, group, "yeni").andExpect(status().isCreated());
        mvc.perform(get(base(f.projectId) + "/conversations").cookie(late.access()))
                .andExpect(jsonPath("$.group.unread").value(1));
        // The history itself is readable (the project group is a shared room).
        assertEquals(3, history(late, f.projectId, group).size());
    }

    @Test
    void noChatResponseEverContainsAnEmailAddress() throws Exception {
        Fixture f = fixture();
        UUID group = groupId(f.member, f.projectId);
        UUID direct = openDirect(f.member, f.projectId, f.manager.id());
        send(f.member, f.projectId, group, "selam").andExpect(status().isCreated());
        send(f.manager, f.projectId, direct, "merhaba").andExpect(status().isCreated());

        List<String> bodies = new ArrayList<>();
        bodies.add(body(mvc.perform(get(base(f.projectId) + "/conversations").cookie(f.member.access()))));
        bodies.add(body(mvc.perform(get(base(f.projectId) + "/members").cookie(f.member.access()))));
        bodies.add(body(mvc.perform(get(messagesUrl(f.projectId, group)).cookie(f.member.access()))));
        bodies.add(body(mvc.perform(get(messagesUrl(f.projectId, direct)).cookie(f.member.access()))));
        bodies.add(body(mvc.perform(postReq(f.member, base(f.projectId) + "/direct/" + f.otherMember.id(), null))));
        bodies.add(body(send(f.member, f.projectId, group, "bir daha")));
        for (String response : bodies) {
            assertNoEmail(response);
        }
    }

    // ---- helpers ------------------------------------------------------------------------------------------------

    private record Fixture(UUID projectId, Account manager, Account member, Account otherMember, Account outsider,
                           Account foreignManager) {
    }

    private Fixture fixture() throws Exception {
        Account manager = account("chatmanager");
        Account member = account("chatmember");
        Account otherMember = account("chatother");
        Account outsider = account("chatoutsider");
        Account foreignManager = account("chatforeign");
        UUID projectId = createProject(manager, "Chat project");
        createProject(foreignManager, "Foreign project");
        memberships.addMember(manager.id(), projectId, member.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));
        memberships.addMember(manager.id(), projectId, otherMember.id(), Set.of(ProjectRole.TESTER));
        return new Fixture(projectId, manager, member, otherMember, outsider, foreignManager);
    }

    private static String base(UUID projectId) {
        return "/api/v1/projects/" + projectId + "/chat";
    }

    private static String messagesUrl(UUID projectId, UUID conversationId) {
        return base(projectId) + "/conversations/" + conversationId + "/messages";
    }

    private UUID groupId(Account actor, UUID projectId) throws Exception {
        String body = body(mvc.perform(get(base(projectId) + "/conversations").cookie(actor.access()))
                .andExpect(status().isOk()));
        return UUID.fromString(JsonPath.read(body, "$.group.id"));
    }

    private UUID openDirect(Account actor, UUID projectId, UUID target) throws Exception {
        String body = body(mvc.perform(postReq(actor, base(projectId) + "/direct/" + target, null))
                .andExpect(status().isOk()));
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    private ResultActions send(Account actor, UUID projectId, UUID conversationId, String content) throws Exception {
        return postJson(actor, messagesUrl(projectId, conversationId), "{\"content\":" + quote(content) + "}");
    }

    private ResultActions postJson(Account actor, String url, String json) throws Exception {
        return mvc.perform(postReq(actor, url, json));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder postReq(
            Account actor, String url, String json) throws Exception {
        Cookie csrf = csrfCookie();
        var request = post(url).cookie(csrf, actor.access()).header("X-XSRF-TOKEN", csrf.getValue());
        return json == null ? request : request.contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private List<String> contents(String page) {
        return JsonPath.read(page, "$.messages[*].content");
    }

    private String historyPage(Account actor, UUID projectId, UUID conversationId) throws Exception {
        return page(actor, messagesUrl(projectId, conversationId) + "?limit=30");
    }

    private List<Object> history(Account actor, UUID projectId, UUID conversationId) throws Exception {
        return history(actor, projectId, conversationId, 30);
    }

    private List<Object> history(Account actor, UUID projectId, UUID conversationId, int limit) throws Exception {
        String page = page(actor, messagesUrl(projectId, conversationId) + "?limit=" + limit);
        return JsonPath.read(page, "$.messages");
    }

    private String page(Account actor, String url) throws Exception {
        return body(mvc.perform(get(url).cookie(actor.access())).andExpect(status().isOk()));
    }

    private static String body(ResultActions actions) throws Exception {
        return actions.andReturn().getResponse().getContentAsString();
    }

    private static void assertNoEmail(String body) {
        assertFalse(body.contains("@example.test"), "response leaks an email: " + body);
        assertFalse(body.toLowerCase().contains("\"email\""), "response has an email field: " + body);
    }

    private static String quote(String text) {
        return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r")
                + "\"";
    }

    private <T> List<T> runConcurrently(int threads, Callable<T> task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
            List<Future<T>> futures = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return task.call();
                }));
            }
            start.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> future : futures) {
                results.add(future.get());
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
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
        return new Account(id, access);
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        assertTrue(cookie.getValue().length() > 10);
        return cookie;
    }

    private static Cookie cookie(java.util.Collection<String> headers, String name) {
        String value = headers.stream().filter(header -> header.startsWith(name + "="))
                .findFirst().orElseThrow().split(";", 2)[0].substring(name.length() + 1);
        return new Cookie(name, value);
    }

    private record Account(UUID id, Cookie access) {
    }
}
