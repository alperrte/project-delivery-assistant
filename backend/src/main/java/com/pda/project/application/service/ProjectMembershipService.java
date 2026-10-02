package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.ProjectMemberRemovedEvent;
import com.pda.project.ProjectMembershipEvents;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.user.ProjectPermission;
import com.pda.user.ProjectRole;
import com.pda.user.RolePolicy;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.user.UserAccounts;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.Instant;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectMembershipService {

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final UserAccounts users;
    private final ApplicationEventPublisher events;

    public ProjectMembershipService(ProjectRepository projects, ProjectMembershipRepository memberships,
                                    UserAccounts users, ApplicationEventPublisher events) {
        this.projects = projects;
        this.memberships = memberships;
        this.users = users;
        this.events = events;
    }

    /** Internal onboarding entry point for the later invitation flow. No direct HTTP add-member route. */
    @Transactional
    public MemberSummary addMember(UUID actorId, UUID projectId, UUID userId, Set<ProjectRole> roles) {
        lockForManager(actorId, projectId);
        Objects.requireNonNull(userId, "userId is required");
        if (users.findActiveById(userId).isEmpty()) {
            throw new NoSuchElementException("Active user not found");
        }
        ProjectMembership membership = memberships.findByProjectIdAndUserId(projectId, userId)
                .map(existing -> {
                    if (existing.getStatus() == MembershipStatus.ACTIVE) {
                        throw new MembershipConflictException("User is already a project member");
                    }
                    existing.reactivate(roles);
                    return existing;
                })
                .orElseGet(() -> ProjectMembership.active(projectId, userId, roles));
        MemberSummary result = toSummary(memberships.saveAndFlush(membership));
        events.publishEvent(new ProjectMembershipEvents.MemberAdded(projectId, userId, actorId, Instant.now()));
        return result;
    }

    @Transactional(readOnly = true)
    public Page<MemberSummary> list(UUID actorId, UUID projectId, Pageable pageable) {
        require(actorId, projectId, ProjectPermission.PROJECT_VIEW);
        activeProject(projectId);
        return memberships.findByProjectIdAndStatus(projectId, MembershipStatus.ACTIVE, pageable)
                .map(this::toSummary);
    }

    @Transactional(readOnly = true)
    public MemberSummary detail(UUID actorId, UUID projectId, UUID userId) {
        require(actorId, projectId, ProjectPermission.PROJECT_VIEW);
        activeProject(projectId);
        return toSummary(activeMember(projectId, userId));
    }

    /** PROJECT_MANAGER-only lookup for the "add member" flow; delegates to the User module's public search contract. */
    @Transactional(readOnly = true)
    public List<UserAccounts.UserSearchResult> searchAddableUsers(UUID actorId, UUID projectId, String query) {
        requireManager(actorId, projectId);
        activeProject(projectId);
        return users.searchActiveUsers(query, 20);
    }

    @Transactional
    public MemberSummary addRole(UUID actorId, UUID projectId, UUID userId, ProjectRole role) {
        lockForManager(actorId, projectId);
        ProjectMembership member = activeMember(projectId, userId);
        Set<ProjectRole> before = member.getRoles();
        member.addRole(role);
        MemberSummary result = toSummary(memberships.saveAndFlush(member));
        if (!before.equals(member.getRoles())) events.publishEvent(
                new ProjectMembershipEvents.RolesChanged(projectId, userId, actorId, Instant.now()));
        return result;
    }

    @Transactional
    public MemberSummary replaceRoles(UUID actorId, UUID projectId, UUID userId, Set<ProjectRole> roles) {
        Project project = lockForManager(actorId, projectId);
        ProjectMembership member = activeMember(projectId, userId);
        Set<ProjectRole> before = member.getRoles();
        if (roles == null || roles.isEmpty()) {
            throw new IllegalArgumentException("at least one role is required");
        }
        if (member.hasRole(ProjectRole.PROJECT_MANAGER) && !roles.contains(ProjectRole.PROJECT_MANAGER)) {
            requireNotOwner(project, userId);
            requireAnotherManager(projectId);
        }
        member.replaceRoles(roles);
        MemberSummary result = toSummary(memberships.saveAndFlush(member));
        if (!before.equals(member.getRoles())) events.publishEvent(
                new ProjectMembershipEvents.RolesChanged(projectId, userId, actorId, Instant.now()));
        return result;
    }

    @Transactional
    public MemberSummary removeRole(UUID actorId, UUID projectId, UUID userId, ProjectRole role) {
        Project project = lockForManager(actorId, projectId);
        ProjectMembership member = activeMember(projectId, userId);
        if (role == ProjectRole.PROJECT_MANAGER && member.hasRole(role)) {
            requireNotOwner(project, userId);
            requireAnotherManager(projectId);
        }
        member.removeRole(role);
        MemberSummary result = toSummary(memberships.saveAndFlush(member));
        events.publishEvent(new ProjectMembershipEvents.RolesChanged(projectId, userId, actorId, Instant.now()));
        return result;
    }

    @Transactional
    public void removeMember(UUID actorId, UUID projectId, UUID userId) {
        Project project = lockForManager(actorId, projectId);
        ProjectMembership member = activeMember(projectId, userId);
        requireNotOwner(project, userId);
        if (member.hasRole(ProjectRole.PROJECT_MANAGER)) {
            requireAnotherManager(projectId);
        }
        member.remove();
        memberships.saveAndFlush(member);
        events.publishEvent(new ProjectMembershipEvents.MemberRemoved(projectId, member.getId()));
        events.publishEvent(new ProjectMemberRemovedEvent(projectId, userId, actorId, Instant.now()));
    }

    private void requireAnotherManager(UUID projectId) {
        if (memberships.countWithRole(projectId, MembershipStatus.ACTIVE, ProjectRole.PROJECT_MANAGER) <= 1) {
            throw new MembershipConflictException("The last Project Manager must remain assigned",
                    MembershipConflictException.LAST_PROJECT_MANAGER);
        }
    }

    /** The founder stays in the project and keeps the Project Manager role; teams stay free. */
    private static void requireNotOwner(Project project, UUID userId) {
        if (userId.equals(project.getCreatedBy())) {
            throw new MembershipConflictException("The project founder cannot be removed",
                    MembershipConflictException.OWNER_PROTECTED);
        }
    }

    private Project lockForManager(UUID actorId, UUID projectId) {
        requireManager(actorId, projectId);
        Objects.requireNonNull(projectId, "projectId is required");
        Project project = projects.lockActive(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
        requireManager(actorId, projectId);
        return project;
    }

    private void activeProject(UUID projectId) {
        projects.findByIdAndArchivedAtIsNull(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
    }

    private ProjectMembership requireMember(UUID actorId, UUID projectId) {
        Objects.requireNonNull(actorId, "actorId is required");
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, actorId, MembershipStatus.ACTIVE)
                .orElseThrow(() -> new AccessDeniedException("Project access denied"));
    }

    private void require(UUID actorId, UUID projectId, ProjectPermission permission) {
        if (!RolePolicy.allows(requireMember(actorId, projectId).getRoles(), permission)) {
            throw new AccessDeniedException("Project permission denied");
        }
    }

    private void requireManager(UUID actorId, UUID projectId) {
        require(actorId, projectId, ProjectPermission.MEMBER_MANAGE);
    }

    private MemberSummary toSummary(ProjectMembership membership) {
        UserAccounts.AuthenticatedUser account = users.findActiveById(membership.getUserId()).orElse(null);
        return MemberSummary.from(membership, account == null ? null : account.nickname(),
                account == null ? null : account.profilePhotoVersion());
    }

    private ProjectMembership activeMember(UUID projectId, UUID userId) {
        Objects.requireNonNull(userId, "userId is required");
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.ACTIVE)
                .orElseThrow(() -> new NoSuchElementException("Project member not found"));
    }
}
