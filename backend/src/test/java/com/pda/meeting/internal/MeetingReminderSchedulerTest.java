package com.pda.meeting.internal;

import org.junit.jupiter.api.Test;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MeetingReminderSchedulerTest {
    @Test void slowMailDoesNotBlockSharedSchedulerOrQueueOverlappingRuns() throws Exception {
        var dispatcher=mock(MeetingReminderDispatcher.class);
        var entered=new CountDownLatch(1); var release=new CountDownLatch(1); var finished=new CountDownLatch(1);
        doAnswer(i->{entered.countDown();try{release.await(5,TimeUnit.SECONDS);}finally{finished.countDown();}return null;}).when(dispatcher).dispatch();
        try(var scheduler=new MeetingReminderScheduler(dispatcher)) {
            scheduler.reconcile(); assertTrue(entered.await(2,TimeUnit.SECONDS));
            // These return while SMTP is still blocked, without accumulating more mail work.
            scheduler.reconcile(); scheduler.reconcile(); verify(dispatcher,times(1)).dispatch();
            release.countDown(); assertTrue(finished.await(2,TimeUnit.SECONDS));
        } finally { release.countDown(); }
    }
    @Test void shutdownRejectsNewWorkWithoutBreakingApplicationShutdown() {
        var dispatcher=mock(MeetingReminderDispatcher.class); var scheduler=new MeetingReminderScheduler(dispatcher);
        scheduler.close(); assertDoesNotThrow(scheduler::reconcile); verifyNoInteractions(dispatcher);
    }
}
