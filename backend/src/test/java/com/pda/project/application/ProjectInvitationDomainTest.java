package com.pda.project.application;

import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.enums.InvitationStatus;
import com.pda.user.ProjectRole;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjectInvitationDomainTest {

    private final UUID projectId = UUID.randomUUID();
    private final UUID invitedUserId = UUID.randomUUID();
    private final UUID invitedBy = UUID.randomUUID();
    private final Instant now = Instant.now();

    @Test
    void registeredUserInvitationStartsPendingAndHashesToken() {
        ProjectInvitation invitation = ProjectInvitation.forRegisteredUser(projectId, invitedUserId, invitedBy,
                Set.of(ProjectRole.TESTER), "raw-token", now.plus(7, ChronoUnit.DAYS));

        assertEquals(InvitationStatus.PENDING, invitation.getStatus());
        assertEquals(invitedUserId, invitation.getInvitedUserId());
        assertNull(invitation.getEmail());
        assertEquals(Set.of(ProjectRole.TESTER), invitation.getInitialRoles());
        assertTrue(invitation.matchesToken("raw-token"));
        assertFalse(invitation.matchesToken("wrong-token"));
        assertFalse(invitation.matchesToken(null));
    }

    @Test
    void emailInvitationRequiresNonBlankEmailAndAtLeastOneRole() {
        ProjectInvitation invitation = ProjectInvitation.forEmail(projectId, "  invitee@example.test  ", invitedBy,
                Set.of(ProjectRole.BACKEND_DEVELOPER), "raw-token", now.plus(7, ChronoUnit.DAYS));
        assertEquals("invitee@example.test", invitation.getEmail());
        assertNull(invitation.getInvitedUserId());

        assertThrows(IllegalArgumentException.class, () -> ProjectInvitation.forEmail(projectId, " ", invitedBy,
                Set.of(ProjectRole.TESTER), "raw-token", now.plus(1, ChronoUnit.DAYS)));
        assertThrows(IllegalArgumentException.class, () -> ProjectInvitation.forRegisteredUser(projectId,
                invitedUserId, invitedBy, Set.of(), "raw-token", now.plus(1, ChronoUnit.DAYS)));
        assertThrows(NullPointerException.class, () -> ProjectInvitation.forRegisteredUser(null, invitedUserId,
                invitedBy, Set.of(ProjectRole.TESTER), "raw-token", now.plus(1, ChronoUnit.DAYS)));
    }

    @Test
    void acceptRejectAndCancelRequirePendingAndAreMutuallyExclusive() {
        ProjectInvitation accepted = pendingInvitation();
        accepted.accept(now);
        assertEquals(InvitationStatus.ACCEPTED, accepted.getStatus());
        assertNotNull(accepted.getAcceptedAt());
        assertThrows(IllegalStateException.class, () -> accepted.accept(now));
        assertThrows(IllegalStateException.class, () -> accepted.reject(now));
        assertThrows(IllegalStateException.class, () -> accepted.cancel(now));

        ProjectInvitation rejected = pendingInvitation();
        rejected.reject(now);
        assertEquals(InvitationStatus.REJECTED, rejected.getStatus());
        assertNotNull(rejected.getRejectedAt());

        ProjectInvitation cancelled = pendingInvitation();
        cancelled.cancel(now);
        assertEquals(InvitationStatus.CANCELLED, cancelled.getStatus());
        assertNotNull(cancelled.getCancelledAt());
    }

    @Test
    void expiredInvitationCannotBeAcceptedRejectedOrCancelled() {
        ProjectInvitation invitation = ProjectInvitation.forRegisteredUser(projectId, invitedUserId, invitedBy,
                Set.of(ProjectRole.TESTER), "raw-token", now.minus(1, ChronoUnit.MINUTES));

        assertFalse(invitation.isPending(now));
        assertThrows(IllegalStateException.class, () -> invitation.accept(now));

        invitation.expire(now);
        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());

        // Idempotent: expiring an already-terminal invitation (or a still-pending one) is a safe no-op.
        invitation.expire(now);
        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
        ProjectInvitation stillPending = pendingInvitation();
        stillPending.expire(now);
        assertEquals(InvitationStatus.PENDING, stillPending.getStatus());
    }

    private ProjectInvitation pendingInvitation() {
        return ProjectInvitation.forRegisteredUser(projectId, invitedUserId, invitedBy,
                Set.of(ProjectRole.TESTER), "raw-token-" + UUID.randomUUID(), now.plus(7, ChronoUnit.DAYS));
    }
}
