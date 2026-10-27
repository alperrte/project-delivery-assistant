package com.pda.meeting;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.time.Instant;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

/** Meeting events that were stored (Modulith publication log) before meetings left projects still carry a projectId; replaying them must keep working. */
class MeetingEventsCompatibilityTest {
    @Test void anEventStoredWithAProjectIdStillDeserializesAndTheProjectIsIgnored() {
        UUID event = UUID.randomUUID(), meeting = UUID.randomUUID(), project = UUID.randomUUID(), actor = UUID.randomUUID(), recipient = UUID.randomUUID();
        String legacy = """
            {"eventId":"%s","meetingId":"%s","projectId":"%s","actorId":"%s","type":"CREATED","title":"Old meeting",
             "recipientIds":["%s"],"occurredAt":"2026-10-20T09:00:00Z"}""".formatted(event, meeting, project, actor, recipient);
        // A strict mapper (unknown properties fail) proves the record itself tolerates the retired field, whatever the application mapper is set to.
        var strict = JsonMapper.builder().enable(tools.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();
        var restored = strict.readValue(legacy, MeetingEvents.Changed.class);
        assertEquals(event, restored.eventId()); assertEquals(meeting, restored.meetingId()); assertEquals(actor, restored.actorId());
        assertEquals(MeetingEvents.Type.CREATED, restored.type()); assertEquals(java.util.Set.of(recipient), restored.recipientIds());
        assertEquals(Instant.parse("2026-10-20T09:00:00Z"), restored.occurredAt());
    }
}
