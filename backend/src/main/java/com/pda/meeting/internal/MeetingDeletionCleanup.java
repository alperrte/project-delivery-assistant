package com.pda.meeting.internal;
import com.pda.meeting.MeetingMediaPort;
import com.pda.project.ProjectDeletedEvent;
import org.springframework.stereotype.Service;
import org.springframework.context.event.EventListener;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
@Service
public class MeetingDeletionCleanup {
    private final MeetingRepository meetings;
    private final MeetingRoomCleanupRepository cleanup;
    private final MeetingMediaPort media;
    public MeetingDeletionCleanup(MeetingRepository meetings,MeetingRoomCleanupRepository cleanup,MeetingMediaPort media) { this.meetings=meetings; this.cleanup=cleanup; this.media=media; }
    @EventListener @Transactional
    public void deleted(ProjectDeletedEvent event) {
        for(var id:meetings.idsByProject(event.projectId())) {
            var meeting=meetings.lock(id).orElse(null); if(meeting==null) continue;
            tombstone(meeting.roomName); if(meeting.pendingRoomName!=null) tombstone(meeting.pendingRoomName);
        }
    }
    private void tombstone(String roomName) { if(cleanup.existsById(roomName)) return; var c=new MeetingRoomCleanup(); c.roomName=roomName; c.retryAt=Instant.now(); cleanup.save(c); }
    @Transactional
    public void retry(String roomName) {
        var c=cleanup.lock(roomName).orElse(null); if(c==null||c.retryAt.isAfter(Instant.now())) return;
        try { media.deleteRoom(roomName); if(media.roomExists(roomName)) throw new IllegalStateException(); cleanup.delete(c); }
        catch(RuntimeException unavailable) { c.attempts++; c.retryAt=Instant.now().plusSeconds(Math.min(300,10L*c.attempts)); }
    }
}
