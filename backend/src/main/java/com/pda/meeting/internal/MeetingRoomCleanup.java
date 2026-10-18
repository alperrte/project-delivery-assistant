package com.pda.meeting.internal;
import jakarta.persistence.*;
import java.time.Instant;
/** Tombstone deliberately has no project/meeting FK, so deletion cannot erase pending SFU cleanup. */
@Entity @Table(name="meeting_room_cleanup")
public class MeetingRoomCleanup {
    @Id @Column(length=100) public String roomName;
    @Column(nullable=false) public int attempts;
    @Column(nullable=false) public Instant retryAt;
}
