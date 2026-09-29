package com.pda.squad.application.service;

import com.pda.project.ProjectAccess;
import com.pda.squad.domain.entity.Squad;
import com.pda.squad.SquadMembershipEvents;
import com.pda.squad.domain.entity.SquadMembership;
import com.pda.squad.infrastructure.repository.SquadMembershipRepository;
import com.pda.squad.infrastructure.repository.SquadRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.UserAccounts;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Squad create/update/archive and membership use-cases (HMZ-PROJ-18/19). A squad grants no authorization by
 * itself: only a project role (via {@code RolePolicy}) decides what a user may do. Squad is its own Spring
 * Modulith module, so it never touches Project's repositories or entities directly — only {@link ProjectAccess},
 * Project's public contract, which is also what makes "is this an active project member" the same check as
 * "is this user addable to one of the project's squads".
 */
@Service
public class SquadService {

    private final ProjectAccess projectAccess;
    private final SquadRepository squads;
    private final SquadMembershipRepository squadMembers;
    private final UserAccounts users;
    private final ApplicationEventPublisher events;

    public SquadService(ProjectAccess projectAccess, SquadRepository squads,
                        SquadMembershipRepository squadMembers, UserAccounts users,
                        ApplicationEventPublisher events) {
        this.projectAccess = projectAccess;
        this.squads = squads;
        this.squadMembers = squadMembers;
        this.users = users;
        this.events = events;
    }

    @Transactional
    public Squad create(UUID actorId, UUID projectId, String name, String description) {
        requireSquadManager(actorId, projectId);
        return squads.saveAndFlush(Squad.create(projectId, name, description, actorId));
    }

    @Transactional(readOnly = true)
    public Page<Squad> list(UUID actorId, UUID projectId, Pageable pageable) {
        requireMember(actorId, projectId);
        return squads.findByProjectIdAndArchivedAtIsNull(projectId, pageable);
    }

    @Transactional(readOnly = true)
    public Squad detail(UUID actorId, UUID projectId, UUID squadId) {
        requireMember(actorId, projectId);
        return activeSquadIn(projectId, squadId);
    }

    @Transactional
    public Squad update(UUID actorId, UUID projectId, UUID squadId, String name, String description) {
        requireSquadManager(actorId, projectId);
        Squad squad = activeSquadIn(projectId, squadId);
        squad.updateDetails(name, description);
        return squads.save(squad);
    }

    @Transactional
    public void archive(UUID actorId, UUID projectId, UUID squadId) {
        requireSquadManager(actorId, projectId);
        Squad squad = activeSquadIn(projectId, squadId);
        squad.archive();
        squads.save(squad);
    }

    @Transactional(readOnly = true)
    public Page<SquadMemberSummary> listMembers(UUID actorId, UUID projectId, UUID squadId, Pageable pageable) {
        requireMember(actorId, projectId);
        activeSquadIn(projectId, squadId);
        return squadMembers.findBySquadId(squadId, pageable).map(this::toSummary);
    }

    /** Only a currently active member of the project may be added; membership carries no role by itself. */
    @Transactional
    public SquadMemberSummary addMember(UUID actorId, UUID projectId, UUID squadId, UUID userId) {
        requireSquadManager(actorId, projectId);
        activeSquadIn(projectId, squadId);
        Objects.requireNonNull(userId, "userId is required");
        if (!projectAccess.isMember(projectId, userId)) {
            throw new NoSuchElementException("Active project member not found");
        }
        if (squadMembers.existsBySquadIdAndUserId(squadId, userId)) {
            throw new SquadConflictException("User is already a squad member");
        }
        SquadMemberSummary result = toSummary(squadMembers.saveAndFlush(SquadMembership.add(squadId, userId, actorId)));
        events.publishEvent(new SquadMembershipEvents.MemberAdded(squadId, projectId, userId, actorId, Instant.now()));
        return result;
    }

    private SquadMemberSummary toSummary(SquadMembership membership) {
        String nickname = users.findActiveById(membership.getUserId())
                .map(UserAccounts.AuthenticatedUser::nickname)
                .orElse(null);
        return SquadMemberSummary.from(membership, nickname);
    }

    @Transactional
    public void removeMember(UUID actorId, UUID projectId, UUID squadId, UUID userId) {
        requireSquadManager(actorId, projectId);
        activeSquadIn(projectId, squadId);
        SquadMembership membership = squadMembers.findBySquadIdAndUserId(squadId, userId)
                .orElseThrow(() -> new NoSuchElementException("Squad member not found"));
        squadMembers.delete(membership);
        events.publishEvent(new SquadMembershipEvents.MemberRemoved(squadId, projectId, userId, actorId, Instant.now()));
    }

    private Squad activeSquadIn(UUID projectId, UUID squadId) {
        Objects.requireNonNull(squadId, "squadId is required");
        return squads.findByIdAndArchivedAtIsNull(squadId)
                .filter(candidate -> candidate.getProjectId().equals(projectId))
                .orElseThrow(() -> new NoSuchElementException("Squad not found"));
    }

    private void requireMember(UUID actorId, UUID projectId) {
        Objects.requireNonNull(actorId, "actorId is required");
        Objects.requireNonNull(projectId, "projectId is required");
        if (!projectAccess.isMember(projectId, actorId)) {
            throw new AccessDeniedException("Project access denied");
        }
    }

    private void requireSquadManager(UUID actorId, UUID projectId) {
        requireMember(actorId, projectId);
        if (!projectAccess.hasPermission(projectId, actorId, ProjectPermission.SQUAD_MANAGE)) {
            throw new AccessDeniedException("Squad management denied");
        }
    }
}
