package com.pda.meeting;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public final class MeetingEvents {
    private MeetingEvents() {}
    public enum Type { CREATED, UPDATED, CANCELLED, OPENED, OVERTIME, ENDED }
    public record Changed(UUID eventId, UUID meetingId, UUID projectId, UUID actorId, Type type,
                          String title, Set<UUID> recipientIds, Instant occurredAt) {
        public Changed { recipientIds = Set.copyOf(recipientIds); }
    }
}
