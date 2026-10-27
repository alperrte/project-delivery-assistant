package com.pda.meeting.internal;
import com.pda.meeting.MeetingMediaPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
/**
 * Drains the SFU room tombstones that were written when a project was deleted. Meetings no longer belong to projects, so deleting
 * a project neither deletes a meeting nor writes new tombstones; rows already in the ledger are still retried until the rooms are gone.
 */
@Service
public class MeetingDeletionCleanup {
    private final MeetingRoomCleanupRepository cleanup;
    private final MeetingMediaPort media;
    public MeetingDeletionCleanup(MeetingRoomCleanupRepository cleanup,MeetingMediaPort media) { this.cleanup=cleanup; this.media=media; }
    @Transactional
    public void retry(String roomName) {
        var c=cleanup.lock(roomName).orElse(null); if(c==null||c.retryAt.isAfter(Instant.now())) return;
        try { media.deleteRoom(roomName); if(media.roomExists(roomName)) throw new IllegalStateException(); cleanup.delete(c); }
        catch(RuntimeException unavailable) { c.attempts++; c.retryAt=Instant.now().plusSeconds(Math.min(300,10L*c.attempts)); }
    }
}
