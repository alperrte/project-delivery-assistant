package com.pda.project.application.service;

import com.pda.project.ProjectMemberRemovedEvent;
import com.pda.project.ProjectMembershipEvents;
import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.InvitationStatus;
import com.pda.project.infrastructure.repository.ProjectInvitationRepository;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.user.UserAccountDeletedEvent;
import java.time.Instant;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Memberships and invitations hold the user id as a scalar, so an anonymised account would stay on every team. They go
 * away inside the deleting transaction, through the same events a normal removal publishes (teams, assignments and
 * watchers clean up from those). The user is the actor of their own removal, so nobody is notified.
 */
@Component
public class ProjectAccountDeletionCleanup {

    private final ProjectMembershipRepository memberships;
    private final ProjectInvitationRepository invitations;
    private final ApplicationEventPublisher events;

    public ProjectAccountDeletionCleanup(ProjectMembershipRepository memberships,
                                         ProjectInvitationRepository invitations, ApplicationEventPublisher events) {
        this.memberships = memberships;
        this.invitations = invitations;
        this.events = events;
    }

    @EventListener
    @Transactional
    public void accountDeleted(UserAccountDeletedEvent event) {
        Instant now = Instant.now();
        for (ProjectInvitation invitation : invitations.findByInvitedUserIdAndStatus(event.userId(),
                InvitationStatus.PENDING)) {
            invitation.cancel(now);
        }
        for (ProjectMembership membership : memberships.findActiveByUser(event.userId())) {
            membership.remove();
            memberships.saveAndFlush(membership);
            events.publishEvent(new ProjectMembershipEvents.MemberRemoved(membership.getProjectId(), membership.getId()));
            events.publishEvent(new ProjectMemberRemovedEvent(membership.getProjectId(), event.userId(), event.userId(), now));
        }
    }
}
