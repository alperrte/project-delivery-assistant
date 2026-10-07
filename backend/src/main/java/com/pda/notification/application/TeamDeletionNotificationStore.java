package com.pda.notification.application;

import com.pda.notification.domain.Notification;
import com.pda.notification.domain.TeamDeletion;
import com.pda.squad.SquadLifecycleEvents.TeamDeleted;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** One fanout transaction; bounded JDBC batches and event/recipient uniqueness make publication replay safe. */
@Service
public class TeamDeletionNotificationStore {
    private static final int BATCH_SIZE = 500;
    private static final String INSERT = "INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,"
            + "actor_user_id,project_id,resource_type,resource_id,source_event_id,team_deleted_project_name,"
            + "team_deleted_team_name,team_deleted_actor_nickname,team_deleted_at) "
            + "VALUES (?,?,'SQUAD_DELETED',?,?,false,?,?,?,'SQUAD',?,?,?,?,?,?) "
            + "ON CONFLICT (source_event_id,recipient_user_id) WHERE source_event_id IS NOT NULL DO NOTHING";
    private final JdbcTemplate db;
    private final NotificationFactory factory;

    public TeamDeletionNotificationStore(JdbcTemplate db, NotificationFactory factory) {
        this.db = db; this.factory = factory;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void save(TeamDeleted event) {
        TeamDeletion snapshot = new TeamDeletion(event.projectName(), event.teamName(), event.actorNickname(), event.occurredAt());
        List<Object[]> batch = new ArrayList<>(BATCH_SIZE);
        for (UUID recipient : event.recipientIds().stream().sorted().toList()) {
            if (recipient.equals(event.deletedBy())) continue;
            Notification n = factory.teamDeleted(recipient, event.deletedBy(), event.projectId(), event.teamId(), event.eventId(), snapshot);
            batch.add(new Object[]{n.getId(), recipient, n.getTitle(), n.getMessage(), Timestamp.from(n.getCreatedAt()),
                    event.deletedBy(), event.projectId(), event.teamId(), event.eventId(), snapshot.projectName(),
                    snapshot.teamName(), snapshot.actorNickname(), Timestamp.from(snapshot.occurredAt())});
            if (batch.size() == BATCH_SIZE) { db.batchUpdate(INSERT, batch); batch.clear(); }
        }
        if (!batch.isEmpty()) db.batchUpdate(INSERT, batch);
    }
}
