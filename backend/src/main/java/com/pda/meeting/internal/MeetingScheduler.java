package com.pda.meeting.internal;
import com.pda.meeting.MeetingPolicy;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.data.domain.PageRequest;
import java.time.Instant;
@Component
public class MeetingScheduler {
    private final MeetingRepository meetings;
    private final MeetingLifecycle lifecycle;
    private final MeetingPolicy policy;
    private final MeetingRoomCleanupRepository cleanup;
    private final MeetingDeletionCleanup deletion;
    public MeetingScheduler(MeetingRepository meetings,MeetingLifecycle lifecycle,MeetingPolicy policy,MeetingRoomCleanupRepository cleanup,MeetingDeletionCleanup deletion) { this.meetings=meetings; this.lifecycle=lifecycle; this.policy=policy; this.cleanup=cleanup; this.deletion=deletion; }
    @Scheduled(fixedDelay=10000,initialDelay=10000)
    public void reconcile() {
        if(!policy.isEnabled()) return;
        for(var pending:cleanup.findByRetryAtLessThanEqual(Instant.now(),PageRequest.of(0,100))) try { deletion.retry(pending.roomName); } catch(RuntimeException unavailable) { }
        // IDs only, one transaction/row lock per job; a failure never rolls back independent meetings.
        var ids=new java.util.ArrayList<java.util.UUID>();
        int page=0; java.util.List<java.util.UUID> batch;
        do { batch=meetings.work(Instant.now(),PageRequest.of(page++,1000)); ids.addAll(batch); } while(batch.size()==1000);
        for(var id:ids) try { lifecycle.tick(id); } catch(RuntimeException unavailable) { /* retry next pass; no sensitive exception data logged */ }
    }
}
