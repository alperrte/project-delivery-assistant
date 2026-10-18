package com.pda.meeting.internal;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
@Entity @Table(name="meeting_chat_messages")
public class MeetingChatMessage {
    @Id public UUID id;
    @Column(nullable=false) public UUID meetingId;
    @Column(nullable=false) public UUID participantId;
    @Column(nullable=false,length=80) public String displayName;
    @Column(nullable=false,length=2000) public String content;
    @Column(nullable=false) public Instant sentAt;
    @ElementCollection @CollectionTable(name="meeting_chat_mentions",joinColumns=@JoinColumn(name="message_id"))
    @Column(name="participant_id") public Set<UUID> mentionIds=new HashSet<>();
}
