package com.pda.meeting.internal;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
/** Never contains titles, message text, credentials or guest secrets. */
@Entity @Table(name="meeting_audit")
public class MeetingAudit {
    @Id public UUID id;
    @Column(nullable=false) public UUID meetingId;
    public UUID actorId;
    public UUID targetId;
    @Column(nullable=false,length=40) public String action;
    @Column(nullable=false) public Instant occurredAt;
}
