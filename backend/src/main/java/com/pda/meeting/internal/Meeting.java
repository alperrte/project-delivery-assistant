package com.pda.meeting.internal;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;

@Entity @Table(name="meetings")
public class Meeting {
    @Id public UUID id;
    @Version public long version;
    /** Changes only when the start time or invited recipient set changes, independently of lifecycle writes. */
    @Column(nullable=false) public long reminderRevision;
    @Column(nullable=false) public UUID projectId;
    @Column(nullable=false) public UUID organizerId;
    @Column(nullable=false,length=160) public String title;
    @Column(nullable=false,length=4000) public String description;
    @Column(nullable=false) public Instant startsAt;
    @Column(nullable=false) public Instant endsAt;
    @Column(nullable=false,length=80) public String zoneId;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=16) public Status status;
    @Column(nullable=false,unique=true,length=100) public String roomName;
    @Column(nullable=false) public int roomEpoch;
    @Column(nullable=false) public boolean rotationPending;
    @Column(length=100) public String pendingRoomName;
    public Instant openedAt;
    public Instant endedAt;
    public Instant overtimeAt;
    public Instant emptySince;
    @Column(nullable=false) public boolean everJoined;
    @Column(nullable=false) public boolean cleanupPending;
    @Column(nullable=false) public int cleanupAttempts;
    public Instant cleanupRetryAt;
    @Column(nullable=false) public Instant createdAt;
    @Column(nullable=false) public Instant updatedAt;
    @ElementCollection @CollectionTable(name="meeting_agenda",joinColumns=@JoinColumn(name="meeting_id"))
    @OrderColumn(name="position") @Column(name="content",nullable=false,length=1000)
    public List<String> agenda=new ArrayList<>();
    @ElementCollection @CollectionTable(name="meeting_attendees",joinColumns=@JoinColumn(name="meeting_id"))
    @Column(name="user_id",nullable=false) public Set<UUID> attendeeIds=new HashSet<>();
    public enum Status { SCHEDULED, OPEN, ENDED, CANCELLED }
}
