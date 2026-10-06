package com.pda.notification;

import com.pda.notification.application.NotificationFactory;
import com.pda.notification.domain.*;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TeamDeletionNotificationFactoryTest {
    @Test void maximumSnapshotFitsAndPresentationDoesNotChangeReadState() {
        var factory = new NotificationFactory();
        var snapshot = new TeamDeletion("P".repeat(160), "T".repeat(120), "A".repeat(32), Instant.now());
        UUID event = UUID.randomUUID(), actor = UUID.randomUUID(), recipient = UUID.randomUUID();
        var n = factory.teamDeleted(recipient, actor, UUID.randomUUID(), UUID.randomUUID(), event, snapshot);
        assertEquals(snapshot, n.getTeamDeletion());
        assertEquals(event, n.getSourceEventId());
        assertEquals(NotificationType.SQUAD_DELETED, n.getType());
        assertEquals(ResourceType.SQUAD, n.getResourceType());
        assertTrue(n.getMessage().length() <= 500);
        assertTrue(n.getTitle().length() <= 160);
        assertFalse(n.isRead());
        assertNull(n.getReadAt());
        assertNull(n.getPopupPresentedAt());
        assertNull(n.getStatusChange());
        n.markRead();
        assertTrue(n.isRead());
        assertEquals(snapshot, n.getTeamDeletion());
        assertNull(n.getPopupPresentedAt());
    }

    @Test void missingActorNicknameAndLegacyNotificationsRemainValid() {
        var factory = new NotificationFactory();
        var n = factory.teamDeleted(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID(), new TeamDeletion("P", "T", null, Instant.now()));
        assertTrue(n.getMessage().contains("a project manager"));
        var legacy = factory.create(UUID.randomUUID(), null, UUID.randomUUID(), ResourceType.TASK,
                UUID.randomUUID(), NotificationType.TASK_ASSIGNED);
        assertNull(legacy.getTeamDeletion());
        assertNull(legacy.getSourceEventId());
        assertNull(legacy.getPopupPresentedAt());
        assertThrows(IllegalArgumentException.class, () -> factory.create(UUID.randomUUID(), null, null,
                ResourceType.SQUAD, UUID.randomUUID(), NotificationType.SQUAD_DELETED));
        assertThrows(IllegalArgumentException.class, () -> new TeamDeletion(" ", "T", null, Instant.now()));
    }
}
