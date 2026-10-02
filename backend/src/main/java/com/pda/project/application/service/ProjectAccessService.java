package com.pda.project.application.service;

import com.pda.project.ProjectAccess;
import com.pda.project.ProjectTaskContext;
import com.pda.project.ProjectMemberView;
import com.pda.project.ProjectSummaryView;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.infrastructure.repository.ProjectInvitationRepository;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.RolePolicy;
import com.pda.user.UserAccounts;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Set;
import java.util.Map;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Stream;
import com.pda.project.domain.entity.ProjectMembership;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectAccessService implements ProjectAccess {

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final UserAccounts users;
    private final ProjectInvitationRepository invitations;
    private final Clock clock;

    public ProjectAccessService(ProjectRepository projects, ProjectMembershipRepository memberships,
                                UserAccounts users, ProjectInvitationRepository invitations, Clock clock) {
        this.projects = projects;
        this.memberships = memberships;
        this.users = users;
        this.invitations = invitations;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isMember(UUID projectId, UUID userId) {
        if (projectId == null || userId == null || projects.findByIdAndArchivedAtIsNull(projectId).isEmpty()) {
            return false;
        }
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.ACTIVE).isPresent();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isMemberIncludingArchived(UUID projectId, UUID userId) {
        return projectId != null && userId != null && projects.existsById(projectId)
                && memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.ACTIVE).isPresent();
    }

    @Override
    @Transactional(readOnly = true)
    public Set<String> rolesForUserInProject(UUID projectId, UUID userId) {
        if (projectId == null || userId == null || projects.findByIdAndArchivedAtIsNull(projectId).isEmpty()) {
            return Set.of();
        }
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.ACTIVE)
                .map(member -> member.getRoles().stream().map(Enum::name).collect(Collectors.toUnmodifiableSet()))
                .orElseGet(Set::of);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean canAccessProject(UUID projectId, UUID userId) {
        return isMember(projectId, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public Set<ProjectPermission> permissionsForUserInProject(UUID projectId, UUID userId) {
        if (projectId == null || userId == null || projects.findByIdAndArchivedAtIsNull(projectId).isEmpty()) {
            return Set.of();
        }
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.ACTIVE)
                .map(member -> RolePolicy.permissions(member.getRoles()))
                .orElseGet(Set::of);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasPermission(UUID projectId, UUID userId, ProjectPermission permission) {
        return permission != null && permissionsForUserInProject(projectId, userId).contains(permission);
    }

    @Override
    @Transactional(readOnly = true)
    public ProjectTaskContext taskContext(UUID projectId) {
        return projectId == null ? null : projects.findById(projectId)
                .map(project -> new ProjectTaskContext(project.getId(), project.getSlug(),
                        project.getArchivedAt() != null)).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> activeMemberIds(UUID projectId, Set<UUID> userIds) {
        if (projectId == null || userIds == null || userIds.isEmpty()
                || projects.lockActiveShared(projectId).isEmpty()) {
            return Set.of();
        }
        return Set.copyOf(memberships.findActiveUserIds(projectId, userIds));
    }

    @Override
    @Transactional(readOnly = true)
    public ProjectMemberView member(UUID projectId, UUID userId) {
        if (projectId == null || userId == null || projects.findByIdAndArchivedAtIsNull(projectId).isEmpty()) return null;
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.ACTIVE)
                .map(m -> view(m, users.findActiveById(userId).orElse(null))).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, ProjectMemberView> membersByIds(UUID projectId, Set<UUID> membershipIds) {
        if (projectId == null || membershipIds == null || membershipIds.isEmpty()
                || projects.findByIdAndArchivedAtIsNull(projectId).isEmpty()) return Map.of();
        return views(memberships.findByProjectIdAndIdInAndStatus(projectId, membershipIds, MembershipStatus.ACTIVE))
                .stream().collect(Collectors.toMap(ProjectMemberView::membershipId, Function.identity()));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProjectMemberView> members(UUID projectId, Pageable pageable) {
        if (projects.findByIdAndArchivedAtIsNull(projectId).isEmpty()) throw new java.util.NoSuchElementException("Project not found");
        Page<ProjectMembership> page = memberships.findByProjectIdAndStatus(projectId, MembershipStatus.ACTIVE, pageable);
        Map<UUID, ProjectMemberView> mapped = views(page.getContent()).stream()
                .collect(Collectors.toMap(ProjectMemberView::membershipId, Function.identity()));
        return page.map(m -> mapped.get(m.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, UUID> activeMembershipIds(UUID projectId, Set<UUID> userIds) {
        if (projectId == null || userIds == null || userIds.isEmpty()) return Map.of();
        return memberships.findActiveByUserIds(projectId, userIds).stream()
                .collect(Collectors.toMap(ProjectMembership::getUserId, ProjectMembership::getId));
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> pendingInviteeIds(UUID projectId, Set<UUID> userIds) {
        if (projectId == null || userIds == null || userIds.isEmpty()) return Set.of();
        return Set.copyOf(invitations.findPendingInviteeIds(projectId, userIds));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProjectSummaryView> activeProjectsForUser(UUID userId) {
        if (userId == null) return List.of();
        List<ProjectMembership> mine = memberships.findActiveByUser(userId);
        if (mine.isEmpty()) return List.of();
        Map<UUID, ProjectMembership> byProject = mine.stream()
                .collect(Collectors.toMap(ProjectMembership::getProjectId, Function.identity(), (a, b) -> a));
        return projects.findAllById(byProject.keySet()).stream()
                .filter(project -> project.getArchivedAt() == null)
                .map(project -> new ProjectSummaryView(project.getId(), project.getSlug(), project.getName(),
                        project.getLogoUpdatedAt() == null ? null : project.getLogoUpdatedAt().toEpochMilli(),
                        RolePolicy.permissions(byProject.get(project.getId()).getRoles())))
                .sorted(java.util.Comparator.comparing(ProjectSummaryView::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Override
    @Transactional
    public int cancelPendingInvitationsForTeam(UUID projectId, UUID teamId) {
        if (projectId == null || teamId == null) return 0;
        List<ProjectInvitation> pending = invitations.lockPendingForTeam(projectId, teamId);
        java.time.Instant now = clock.instant();
        int cancelled = 0;
        for (ProjectInvitation invitation : pending) {
            if (invitation.isPending(now)) {
                invitation.cancel(now);
                cancelled++;
            } else {
                invitation.expire(now);
            }
        }
        invitations.saveAll(pending);
        return cancelled;
    }

    private List<ProjectMemberView> views(List<ProjectMembership> rows) {
        Map<UUID, UserAccounts.AuthenticatedUser> accounts = users.findActiveByIds(rows.stream()
                .map(ProjectMembership::getUserId).collect(Collectors.toSet()));
        return rows.stream().map(m -> view(m, accounts.get(m.getUserId()))).toList();
    }

    private static ProjectMemberView view(ProjectMembership membership, UserAccounts.AuthenticatedUser account) {
        return new ProjectMemberView(membership.getId(), membership.getUserId(),
                account == null ? null : account.nickname(), account == null ? null : account.email(),
                membership.getRoles(), membership.getJoinedAt(), account == null ? null : account.profilePhotoVersion());
    }
}
