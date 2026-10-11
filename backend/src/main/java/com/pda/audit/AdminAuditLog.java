package com.pda.audit;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Public Audit module contract: a persistent trail of administrator-relevant actions. An event is an id, a time, the acting
 * account (when known), an action code, a target type and id, and an outcome - never free text, an e-mail address, an IP
 * address or a user agent. Callers authorize the administrator themselves; this module does no permission checks.
 */
public interface AdminAuditLog {

    /**
     * Writes one event in its own transaction, so it is kept even when the caller's transaction rolls back (a refused
     * sign-in is the typical case). A failure to write is logged and swallowed: auditing never breaks the action itself.
     */
    void record(AuditAction action, UUID actorUserId, AuditTargetType targetType, UUID targetId, AuditOutcome outcome);

    /** Newest first. Every filter is optional; {@code from} is inclusive and {@code toExclusive} exclusive. */
    AuditPage list(AuditAction action, Instant from, Instant toExclusive, int page, int size);

    record AuditEvent(UUID id, Instant occurredAt, UUID actorUserId, AuditAction action, AuditTargetType targetType,
                      UUID targetId, AuditOutcome outcome) {}

    record AuditPage(List<AuditEvent> items, int page, int size, long totalElements) {}
}
