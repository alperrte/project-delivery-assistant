package com.pda.meeting.internal;
import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** One emoji of one participant on one message (see V56): the composite key keeps a person from counting twice. */
@Entity @Table(name="meeting_chat_reactions") @IdClass(MeetingChatReaction.Key.class)
public class MeetingChatReaction {
    @Id @Column(name="message_id") public UUID messageId;
    @Id @Column(name="participant_id") public UUID participantId;
    @Id @Column(nullable=false,length=32) public String emoji;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    public record Key(UUID messageId,UUID participantId,String emoji) implements Serializable {}
}
