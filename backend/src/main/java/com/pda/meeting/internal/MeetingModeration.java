package com.pda.meeting.internal;
import org.springframework.stereotype.Service;
import com.pda.meeting.MeetingException;
import java.util.UUID;
/** Separate transaction boundaries make the ban/old-room ledger durable before remote deletion. */
@Service
public class MeetingModeration {
    private final MeetingService service;
    private final MeetingLifecycle lifecycle;
    public MeetingModeration(MeetingService service,MeetingLifecycle lifecycle) { this.service=service; this.lifecycle=lifecycle; }
    public void kick(UUID meeting,UUID actor,UUID target) {
        service.stageKick(meeting,actor,target);
        if(!lifecycle.retryRotation(meeting)) throw new MeetingException(503,"MEETING_RECONNECT_PENDING");
    }
    public MeetingDtos.View end(UUID meeting,UUID actor) {
        service.end(meeting,actor); // commits ENDED and cleanup intent before remote work
        lifecycle.tick(meeting);
        return service.detail(meeting,actor);
    }
}
