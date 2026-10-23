package com.pda.meeting.internal;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** One member's choice to hide one finished or cancelled meeting from their own list. */
@Entity @Table(name="meeting_user_hidden") @IdClass(MeetingHidden.Key.class)
public class MeetingHidden {
    @Id @Column(name="meeting_id") public UUID meetingId;
    @Id @Column(name="user_id") public UUID userId;
    @Column(name="hidden_at",nullable=false) public Instant hiddenAt;
    public record Key(UUID meetingId,UUID userId) implements Serializable {}
}
