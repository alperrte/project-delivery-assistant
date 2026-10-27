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
    /** The owner. Meetings belong to users (organizer + {@link #attendeeIds}), never to a project. */
    @Column(nullable=false) public UUID organizerId;
    /**
     * The project of a PROJECT meeting; null for an INDEPENDENT one. The type is this column's nullness, so type and link can never disagree, and deleting
     * the project (ON DELETE SET NULL) leaves an independent meeting. It never grants access: that is the organizer and {@link #attendeeIds} only.
     */
    @Column public UUID projectId;
    @Column(nullable=false,length=160) public String title;
    @Column(nullable=false,length=4000) public String description;
    @Column(nullable=false) public Instant startsAt;
    @Column(nullable=false) public Instant endsAt;
    @Column(nullable=false,length=80) public String zoneId;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=16) public Status status;
    /** One of {@link MeetingService#ICONS}; existing meetings keep the video icon. */
    @Column(nullable=false,length=24) public String icon="video";
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
    public enum Kind { PROJECT, INDEPENDENT }
    public Kind kind() { return projectId==null?Kind.INDEPENDENT:Kind.PROJECT; }
    public enum Status { SCHEDULED, OPEN, ENDED, CANCELLED }
}
