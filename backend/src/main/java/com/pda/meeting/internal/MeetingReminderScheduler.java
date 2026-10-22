package com.pda.meeting.internal;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class MeetingReminderScheduler implements AutoCloseable {
    private final MeetingReminderDispatcher dispatcher;
    private final AtomicBoolean running=new AtomicBoolean();
    private final ExecutorService worker=Executors.newSingleThreadExecutor(
            Thread.ofPlatform().daemon(true).name("meeting-reminder-mail-",0).factory());
    public MeetingReminderScheduler(MeetingReminderDispatcher dispatcher) { this.dispatcher=dispatcher; }
    @Scheduled(fixedDelay=15000,initialDelay=15000)
    public void reconcile() {
        // The shared scheduler must stay available for room lifecycle and all other application jobs.
        if(!running.compareAndSet(false,true)) return;
        try {
            worker.execute(()->{
                try { dispatcher.dispatch(); }
                catch(RuntimeException failure) {
                    org.slf4j.LoggerFactory.getLogger(getClass()).warn("Meeting reminder reconciliation outcome=RECOVERY_REQUIRED");
                } finally { running.set(false); }
            });
        } catch(RejectedExecutionException stopping) { running.set(false); }
    }
    @Override @PreDestroy public void close() { worker.shutdownNow(); }
}
