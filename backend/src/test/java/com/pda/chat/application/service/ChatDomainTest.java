package com.pda.chat.application.service;

import com.pda.chat.domain.ChatException;
import com.pda.chat.domain.entity.ChatConversation;
import com.pda.chat.domain.entity.ChatMessage;
import com.pda.chat.domain.enums.ChatConversationType;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChatDomainTest {

    @Test void replyAndReactionFoundationPreservesTextAndTime() {
        UUID conversation = UUID.randomUUID(), sender = UUID.randomUUID(), parent = UUID.randomUUID();
        ChatMessage old = ChatMessage.create(conversation, sender, "😂❤️", NOW);
        assertNull(old.getReplyToMessageId());
        assertEquals(0, old.getReactionVersion());
        ChatMessage reply = ChatMessage.create(conversation, sender, "  answer  ", parent, NOW);
        assertEquals(parent, reply.getReplyToMessageId());
        assertEquals("answer", reply.getContent());
        reply.reactionsChanged(); reply.reactionsChanged();
        assertEquals(2, reply.getReactionVersion());
        assertEquals(NOW.truncatedTo(java.time.temporal.ChronoUnit.MICROS), reply.getCreatedAt());
        for (com.pda.chat.domain.enums.ChatReactionCode code : com.pda.chat.domain.enums.ChatReactionCode.values())
            assertEquals(code, com.pda.chat.domain.enums.ChatReactionCode.parse(code.name()));
        assertThrows(ChatException.class, () -> com.pda.chat.domain.enums.ChatReactionCode.parse("👍"));
    }

    private static final Instant NOW = Instant.parse("2026-10-03T10:15:30.123456789Z");

    // ---- conversations ------------------------------------------------------------------------------------------

    @Test
    void directConversationStoresTheCanonicalPairWhicheverWayRound() {
        UUID project = UUID.randomUUID();
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();

        ChatConversation ab = ChatConversation.direct(project, a, b, NOW);
        ChatConversation ba = ChatConversation.direct(project, b, a, NOW);

        assertEquals(ab.getDirectUserLow(), ba.getDirectUserLow());
        assertEquals(ab.getDirectUserHigh(), ba.getDirectUserHigh());
        assertTrue(ChatConversation.compareLikePostgres(ab.getDirectUserLow(), ab.getDirectUserHigh()) < 0);
        assertEquals(ChatConversationType.DIRECT, ab.getType());
    }

    @Test
    void canonicalOrderFollowsPostgresUnsignedUuidOrderNotJavaSignedOrder() {
        // The first bit of the high half is set: Java's signed comparison would sort this id BEFORE the other one,
        // PostgreSQL (unsigned bytes) sorts it AFTER, and the CHECK (low < high) would reject the row.
        UUID big = UUID.fromString("ffffffff-ffff-4fff-8fff-ffffffffffff");
        UUID small = UUID.fromString("00000000-0000-4000-8000-000000000001");
        assertTrue(big.compareTo(small) < 0, "Java signed order puts the 0xffff... id first");

        ChatConversation conversation = ChatConversation.direct(UUID.randomUUID(), big, small, NOW);

        assertEquals(small, conversation.getDirectUserLow());
        assertEquals(big, conversation.getDirectUserHigh());
    }

    @Test
    void aDirectConversationWithYourselfCannotBeBuilt() {
        UUID user = UUID.randomUUID();
        assertThrows(IllegalArgumentException.class,
                () -> ChatConversation.direct(UUID.randomUUID(), user, user, NOW));
    }

    @Test
    void participantsAndPeers() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID stranger = UUID.randomUUID();
        ChatConversation direct = ChatConversation.direct(UUID.randomUUID(), a, b, NOW);
        ChatConversation group = ChatConversation.projectGroup(UUID.randomUUID(), NOW);

        assertTrue(direct.isParticipant(a));
        assertTrue(direct.isParticipant(b));
        assertFalse(direct.isParticipant(stranger));
        assertFalse(direct.isParticipant(null));
        assertEquals(b, direct.peerOf(a));
        assertEquals(a, direct.peerOf(b));
        assertNull(direct.peerOf(stranger));
        // Group audience comes from ProjectMembership, so the entity itself does not narrow it.
        assertTrue(group.isParticipant(stranger));
        assertNull(group.peerOf(a));
        assertNull(group.getDirectUserLow());
        assertNull(group.getDirectUserHigh());
    }

    // ---- message content ----------------------------------------------------------------------------------------

    @Test
    void validTextIsKeptAndOuterWhitespaceStripped() {
        assertEquals("Merhaba dünya", ChatMessage.normalize("  Merhaba dünya \n"));
        assertEquals("a\tb\nc", ChatMessage.normalize("a\tb\nc"));
    }

    @Test
    void lineEndingsBecomeASingleNewline() {
        assertEquals("one\ntwo\nthree", ChatMessage.normalize("one\r\ntwo\rthree"));
    }

    @Test
    void blankAndWhitespaceOnlyTextIsRejected() {
        for (String blank : new String[] {null, "", "   ", "\n\n", " \t \r\n ", "\u00a0", "\u2003", "\u200b\u200b", "\u00a0\n\u200d"}) {
            assertEquals("CHAT_MESSAGE_EMPTY", codeOf(blank));
        }
    }

    @Test
    void theLimitIsTwoThousandCharactersNotCodeUnits() {
        assertEquals(2000, ChatMessage.normalize("x".repeat(2000)).length());
        assertEquals("CHAT_MESSAGE_TOO_LONG", codeOf("x".repeat(2001)));
        // 2000 emoji are 4000 UTF-16 code units but still 2000 characters for the database and the user.
        String emoji = "😀".repeat(2000);
        assertEquals(emoji, ChatMessage.normalize(emoji));
        assertEquals("CHAT_MESSAGE_TOO_LONG", codeOf("😀".repeat(2001)));
    }

    @Test
    void controlCharactersAreRejectedExceptNewlineAndTab() {
        for (String bad : new String[] {"a\u0000b", "a\u0007b", "a\u001bb", "a\u007fb", "a\u0085b"}) {
            assertEquals("CHAT_MESSAGE_INVALID", codeOf(bad));
        }
    }

    @Test
    void markupIsJustText() {
        String xss = "<script>alert(1)</script><img src=x onerror=alert(1)>";
        assertEquals(xss, ChatMessage.normalize(xss));
    }

    @Test
    void aMessageKeepsMicrosecondTimestampsLikeTheDatabase() {
        ChatMessage message = ChatMessage.create(UUID.randomUUID(), UUID.randomUUID(), "hi", NOW);
        assertEquals(Instant.parse("2026-10-03T10:15:30.123456Z"), message.getCreatedAt());
    }

    // ---- previews -----------------------------------------------------------------------------------------------

    @Test
    void previewIsASingleLineCappedAt140Characters() {
        assertEquals("a b c", ChatService.preview("a\n b\t\tc"));
        String longText = "y".repeat(300);
        String preview = ChatService.preview(longText);
        assertEquals(140, preview.codePointCount(0, preview.length()));
        assertTrue(preview.endsWith("…"));
        assertEquals("x".repeat(140), ChatService.preview("x".repeat(140)));
    }

    // ---- rate limit ---------------------------------------------------------------------------------------------

    @Test
    void sendRateLimitAllowsThirtyPerMinutePerUserAndRecovers() {
        MutableClock clock = new MutableClock(NOW);
        ChatSendRateLimiter limiter = new ChatSendRateLimiter(clock);
        UUID user = UUID.randomUUID();
        UUID other = UUID.randomUUID();

        for (int i = 0; i < 30; i++) {
            assertTrue(limiter.tryAcquire(user), "send " + i);
        }
        assertFalse(limiter.tryAcquire(user));
        assertTrue(limiter.tryAcquire(other), "another user has their own window");

        clock.advanceSeconds(61);
        assertTrue(limiter.tryAcquire(user));
    }

    @Test
    void sendRateLimitCanBeConfiguredForTestEnvironmentsButNeverBelowOne() {
        MutableClock clock = new MutableClock(NOW);
        ChatSendRateLimiter limiter = new ChatSendRateLimiter(clock, 3, 10);
        UUID user = UUID.randomUUID();

        for (int i = 0; i < 3; i++) {
            assertTrue(limiter.tryAcquire(user));
        }
        assertFalse(limiter.tryAcquire(user));
        clock.advanceSeconds(11);
        assertTrue(limiter.tryAcquire(user), "the configured window is 10 seconds");

        assertThrows(IllegalStateException.class, () -> new ChatSendRateLimiter(clock, 0, 60));
        assertThrows(IllegalStateException.class, () -> new ChatSendRateLimiter(clock, 30, 0));
    }

    private static String codeOf(String text) {
        return assertThrows(ChatException.class, () -> ChatMessage.normalize(text)).code();
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant start) {
            this.now = start;
        }

        void advanceSeconds(long seconds) {
            now = now.plusSeconds(seconds);
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
