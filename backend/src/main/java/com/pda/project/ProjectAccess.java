package com.pda.project;

import com.pda.user.ProjectPermission;
import java.util.Set;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Public Project module contract for other modules (Auth, Task, ...). Membership is owned by Project; what a role may
 * do is decided by {@link com.pda.user.RolePolicy}. Callers pass the authenticated user id and must never trust a
 * client-supplied one. Unknown, archived or non-member combinations always answer "no access".
 */
public interface ProjectAccess {
    /** Existing exclusive project row lock, before team/invitation locks; caller checks permission before and after. */
    ProjectTeamContext lockTeamContext(UUID projectId);
    boolean isMember(UUID projectId, UUID userId);
    /** Membership lookup for archived-project conflict classification only; grants no permission. */
    boolean isMemberIncludingArchived(UUID projectId, UUID userId);
    Set<String> rolesForUserInProject(UUID projectId, UUID userId);
    boolean canAccessProject(UUID projectId, UUID userId);

    /** Permissions the user holds in the project through its active membership roles; empty when none. */
    Set<ProjectPermission> permissionsForUserInProject(UUID projectId, UUID userId);

    /** True only when the user is an active member whose roles grant the permission in this very project. */
    boolean hasPermission(UUID projectId, UUID userId, ProjectPermission permission);

    /** Context for task creation; archived projects are visible here only for conflict classification. */
    ProjectTaskContext taskContext(UUID projectId);

    /** Shared row lock, held by the caller transaction; serializes task mutations with founder policy changes. */
    ProjectTaskContext lockTaskContext(UUID projectId);

    /** Active members of an active project among the supplied IDs, in one lookup. */
    Set<UUID> activeMemberIds(UUID projectId, Set<UUID> userIds);

    /** Active project managers of an active project; global roles confer no membership here. */
    Set<UUID> managerUserIds(UUID projectId);

    /** Safe active membership view; null when absent. Does not grant access by itself. */
    ProjectMemberView member(UUID projectId, UUID userId);

    /** Batch view for TeamMembership IDs; excludes removed and cross-project rows. */
    Map<UUID, ProjectMemberView> membersByIds(UUID projectId, Set<UUID> membershipIds);

    /** Active project members, paginated at the database. */
    Page<ProjectMemberView> members(UUID projectId, Pageable pageable);

    /** Active membership id by user id for the supplied users, in one lookup; non-members are absent. */
    Map<UUID, UUID> activeMembershipIds(UUID projectId, Set<UUID> userIds);

    /** The supplied users that currently hold a PENDING invitation to this project, in one lookup. */
    Set<UUID> pendingInviteeIds(UUID projectId, Set<UUID> userIds);

    /** Active (non-archived) projects the user is an active member of, with the permissions held in each. */
    java.util.List<ProjectSummaryView> activeProjectsForUser(UUID userId);

    /** Cancels the PENDING invitations that would add someone to the team; returns how many were cancelled. */
    int cancelPendingInvitationsForTeam(UUID projectId, UUID teamId);
}
