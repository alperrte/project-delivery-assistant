package com.pda.notification.application;
import com.pda.meeting.MeetingEvents;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
/** Atomic replay-safe fanout using the immutable event-time recipient set. */
@Service
public class MeetingNotificationStore {
    private static final int BATCH_SIZE = 500;
    private static final String INSERT = "INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,"
            + "actor_user_id,resource_type,resource_id,source_event_id) "
            + "VALUES (?,?,?,?,?,false,?,?,'MEETING',?,?) "
            + "ON CONFLICT (source_event_id,recipient_user_id) WHERE source_event_id IS NOT NULL DO NOTHING";
    private final JdbcTemplate db;
    private final NotificationFactory factory;
    public MeetingNotificationStore(JdbcTemplate db, NotificationFactory factory) { this.db = db; this.factory = factory; }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void save(MeetingEvents.Changed event) {
        List<Object[]> batch = new ArrayList<>(BATCH_SIZE);
        for (UUID recipient : event.recipientIds().stream().sorted().toList()) {
            var n = factory.meeting(recipient, event);
            batch.add(new Object[]{n.getId(), recipient, n.getType().name(), n.getTitle(), n.getMessage(),
                    Timestamp.from(n.getCreatedAt()), event.actorId(), event.meetingId(), event.eventId()});
            if (batch.size() == BATCH_SIZE) { db.batchUpdate(INSERT, batch); batch.clear(); }
        }
        if (!batch.isEmpty()) db.batchUpdate(INSERT, batch);
    }
}
