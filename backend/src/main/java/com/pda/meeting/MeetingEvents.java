package com.pda.meeting;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public final class MeetingEvents {
    private MeetingEvents() {}
    public enum Type { CREATED, UPDATED, CANCELLED, OPENED, OVERTIME, ENDED }
    /** Recipients are the organizer and the attendees. Publications stored before meetings left projects still carry a projectId, which is ignored. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Changed(UUID eventId, UUID meetingId, UUID actorId, Type type,
                          String title, Set<UUID> recipientIds, Instant occurredAt) {
        public Changed { recipientIds = Set.copyOf(recipientIds); }
    }
}
