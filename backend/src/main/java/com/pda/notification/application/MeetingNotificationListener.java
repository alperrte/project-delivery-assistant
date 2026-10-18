package com.pda.notification.application;
import com.pda.meeting.MeetingEvents;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
@Component
public class MeetingNotificationListener {
    private final MeetingNotificationStore store;
    public MeetingNotificationListener(MeetingNotificationStore store) { this.store = store; }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void changed(MeetingEvents.Changed event) { store.save(event); }
}
