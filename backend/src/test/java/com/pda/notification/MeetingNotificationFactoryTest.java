package com.pda.notification;
import com.pda.meeting.MeetingEvents;
import com.pda.notification.application.NotificationFactory;
import com.pda.notification.domain.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
class MeetingNotificationFactoryTest {
    @Test void lifecycleDisplayIsBoundedAndSnapshotsStayIndependent() {
        for (var type : MeetingEvents.Type.values()) {
            UUID user = UUID.randomUUID();
            var event = new MeetingEvents.Changed(UUID.randomUUID(),UUID.randomUUID(),null,
                    type,"Meeting ".repeat(100),Set.of(user),Instant.now());
            var factory = new NotificationFactory(); var n = factory.meeting(user,event);
            assertEquals("MEETING_"+type.name(),n.getType().name());
            assertEquals(ResourceType.MEETING,n.getResourceType());
            assertEquals(event.eventId(),n.getSourceEventId()); assertEquals(event.occurredAt(),n.getCreatedAt());
            assertTrue(n.getTitle().length()<=160); assertTrue(n.getMessage().length()<=500);
            assertFalse(n.isRead()); assertNull(n.getReadAt()); assertNull(n.getPopupPresentedAt());
            assertNull(n.getStatusChange()); assertNull(n.getTeamDeletion()); assertNull(n.getRepositoryCommits());
            assertNull(n.getInvitationContext());
            assertNull(n.getProjectId(),"a meeting belongs to its people, so its notification carries no project");
            assertThrows(IllegalArgumentException.class,()->factory.create(user,null,null,ResourceType.MEETING,event.meetingId(),n.getType()));
        }
    }
}
