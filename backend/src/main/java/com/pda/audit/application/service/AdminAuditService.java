package com.pda.audit.application.service;

import com.pda.audit.AdminAuditLog;
import com.pda.audit.AuditAction;
import com.pda.audit.AuditOutcome;
import com.pda.audit.AuditTargetType;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuditService implements AdminAuditLog {

    private static final Logger log = LoggerFactory.getLogger(AdminAuditService.class);

    private final JdbcClient jdbc;
    private final Clock clock;

    public AdminAuditService(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AuditAction action, UUID actorUserId, AuditTargetType targetType, UUID targetId,
                       AuditOutcome outcome) {
        try {
            jdbc.sql("""
                    INSERT INTO admin_audit_events (id, occurred_at, actor_user_id, action, target_type, target_id, outcome)
                    VALUES (:id, :at, :actor, :action, :targetType, :targetId, :outcome)
                    """)
                    .param("id", UUID.randomUUID())
                    .param("at", clock.instant().atOffset(ZoneOffset.UTC))
                    .param("actor", actorUserId, java.sql.Types.OTHER)
                    .param("action", action.name())
                    .param("targetType", targetType.name())
                    .param("targetId", targetId, java.sql.Types.OTHER)
                    .param("outcome", outcome.name())
                    .update();
        } catch (RuntimeException exception) {
            // Never break the audited action, and never log anything about it beyond the code.
            log.warn("Audit event {} could not be written", action);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public AuditPage list(AuditAction action, Instant from, Instant toExclusive, int page, int size) {
        List<String> where = new ArrayList<>();
        if (action != null) where.add("action = :action");
        if (from != null) where.add("occurred_at >= :from");
        if (toExclusive != null) where.add("occurred_at < :to");
        String condition = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);

        var count = jdbc.sql("SELECT count(*) FROM admin_audit_events" + condition);
        var select = jdbc.sql("""
                SELECT id, occurred_at, actor_user_id, action, target_type, target_id, outcome FROM admin_audit_events
                """ + condition + " ORDER BY occurred_at DESC, id LIMIT :limit OFFSET :offset");
        if (action != null) {
            count = count.param("action", action.name());
            select = select.param("action", action.name());
        }
        if (from != null) {
            count = count.param("from", from.atOffset(ZoneOffset.UTC));
            select = select.param("from", from.atOffset(ZoneOffset.UTC));
        }
        if (toExclusive != null) {
            count = count.param("to", toExclusive.atOffset(ZoneOffset.UTC));
            select = select.param("to", toExclusive.atOffset(ZoneOffset.UTC));
        }
        long total = count.query(Long.class).single();
        List<AuditEvent> items = select.param("limit", size).param("offset", (long) page * size)
                .query((rs, row) -> new AuditEvent(rs.getObject("id", UUID.class),
                        rs.getObject("occurred_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("actor_user_id", UUID.class), AuditAction.valueOf(rs.getString("action")),
                        AuditTargetType.valueOf(rs.getString("target_type")), rs.getObject("target_id", UUID.class),
                        AuditOutcome.valueOf(rs.getString("outcome"))))
                .list();
        return new AuditPage(items, page, size, total);
    }
}
