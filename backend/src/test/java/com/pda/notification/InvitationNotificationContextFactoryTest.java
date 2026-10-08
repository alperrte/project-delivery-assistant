package com.pda.notification;

import com.pda.notification.application.NotificationFactory;
import com.pda.notification.domain.*;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class InvitationNotificationContextFactoryTest {
    @Test void boundedContextIsInvitationOnlyAndLegacyRemainsNull() {
        var factory = new NotificationFactory();
        UUID recipient = UUID.randomUUID(), actor = UUID.randomUUID(), project = UUID.randomUUID(), invitation = UUID.randomUUID();
        for (var type : new NotificationType[]{NotificationType.PROJECT_INVITATION_CREATED,
                NotificationType.PROJECT_INVITATION_ACCEPTED, NotificationType.PROJECT_INVITATION_REJECTED}) {
            var notification = factory.invitation(recipient, actor, project, invitation, type, "N".repeat(160));
            assertEquals("N".repeat(160), notification.getInvitationContext().projectName());
            assertNull(notification.getStatusChange()); assertNull(notification.getPopupPresentedAt());
            assertNull(factory.invitation(recipient, actor, project, invitation, type, null).getInvitationContext());
        }
        assertThrows(IllegalArgumentException.class, () -> new InvitationContext(" "));
        assertThrows(IllegalArgumentException.class, () -> new InvitationContext("N".repeat(161)));
        assertThrows(IllegalArgumentException.class, () -> factory.create(recipient, actor, project, ResourceType.TASK,
                invitation, NotificationType.TASK_ASSIGNED).withInvitationContext(new InvitationContext("Project")));
    }
}
