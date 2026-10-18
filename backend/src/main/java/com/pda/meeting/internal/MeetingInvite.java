package com.pda.meeting.internal;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="meeting_invites")
public class MeetingInvite {
    @Id public UUID id;
    @Column(nullable=false) public UUID meetingId;
    @Column(nullable=false,unique=true,length=64) public String tokenHash;
    @Column(nullable=false) public Instant expiresAt;
    @Column(nullable=false) public int maxUses;
    @Column(nullable=false) public int uses;
    @Column(nullable=false) public boolean revoked;
}
