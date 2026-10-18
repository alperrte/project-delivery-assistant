package com.pda.meeting.internal;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="meeting_participants",uniqueConstraints=@UniqueConstraint(columnNames={"meetingId","identity"}))
public class MeetingParticipant {
    @Id public UUID id;
    @Column(nullable=false) public UUID meetingId;
    public UUID userId;
    public UUID inviteId;
    @Column(nullable=false,length=80) public String identity;
    @Column(nullable=false,length=80) public String displayName;
    @Column(length=64,unique=true) public String sessionHash;
    public Instant sessionExpiresAt;
    @Column(nullable=false) public boolean revoked;
    @Column(nullable=false) public boolean connected;
    public Instant joinedAt;
    public Instant leftAt;
    public Instant lastMessageAt;
    public Instant lastTokenAt;
}
