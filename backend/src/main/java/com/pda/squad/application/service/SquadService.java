package com.pda.squad.application.service;

import com.pda.project.ProjectAccess;
import com.pda.project.ProjectInvitationEvents;
import com.pda.project.ProjectMemberView;
import com.pda.project.ProjectMembershipEvents;
import com.pda.squad.SquadMembershipEvents;
import com.pda.squad.SquadLifecycleEvents;
import com.pda.squad.application.service.SquadMemberSummary.TeamRef;
import com.pda.squad.application.service.TeamView.LastJoined;
import com.pda.squad.application.service.TeamView.UserRef;
import com.pda.squad.application.service.TeamView.MemberPreview;
import com.pda.squad.domain.entity.Squad;
import com.pda.squad.domain.entity.SquadMembership;
import com.pda.squad.infrastructure.repository.SquadMembershipRepository;
import com.pda.squad.infrastructure.repository.SquadRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.UserAccounts;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Project-scoped organization only. ProjectMembership remains the authority for access and roles.
 *
 * <p>There is no automatic team: a project starts with none, and every active member belongs to at least one
 * team. That invariant is enforced here: the first team always contains its creator, a member cannot be removed
 * from their last team, a team cannot be archived while it would leave someone without one, and invitations carry
 * the team the invitee joins on accepting.
 */
@Service
public class SquadService {
    /** Avatars shown on a team card. */
    static final int PREVIEW_SIZE = 5;
    static final int CANDIDATE_LIMIT = 20;
    static final int CANDIDATE_MIN_QUERY = 2;

    private final ProjectAccess projects;
    private final SquadRepository teams;
    private final SquadMembershipRepository teamMembers;
    private final UserAccounts users;
    private final ApplicationEventPublisher events;

    public SquadService(ProjectAccess projects, SquadRepository teams, SquadMembershipRepository teamMembers,
                        UserAccounts users, ApplicationEventPublisher events) {
        this.projects = projects; this.teams = teams; this.teamMembers = teamMembers;
        this.users = users; this.events = events;
    }

    @EventListener
    @Transactional
    public void projectMemberRemoved(ProjectMembershipEvents.MemberRemoved event) {
        teamMembers.deleteByProjectMembershipId(event.membershipId());
    }

    /**
     * Runs synchronously inside the invitation-accept transaction, so the new project member and their team row
     * commit together and the "everyone is in a team" rule is never visibly broken. It deliberately publishes no
     * {@code MemberAdded}: the person just accepted, so a "you were added to a team" notification would be noise.
     */
    @EventListener
    @Transactional
    public void invitationAccepted(ProjectInvitationEvents.Accepted event) {
        if (event.teamId() == null || event.membershipId() == null) return;
        if (projects.lockTeamContext(event.projectId()) == null) throw new NoSuchElementException("Project not found");
        Squad team = teams.findByIdAndArchivedAtIsNull(event.teamId())
                .filter(candidate -> candidate.getProjectId().equals(event.projectId())).orElse(null);
        if (team == null) throw new NoSuchElementException("Team not found");
        if (teamMembers.existsBySquadIdAndProjectMembershipId(team.getId(), event.membershipId())) return;
        teamMembers.saveAndFlush(SquadMembership.add(team.getId(), event.membershipId(), event.invitedBy()));
        team.touch(event.invitedBy());
        teams.save(team);
    }

    /** Legacy {@code /squads} entry point: a top-level team the creator is not forced into. */
    @Transactional
    public Squad create(UUID actor, UUID projectId, String name, String description) {
        return create(actor, projectId, name, description, null, false);
    }

    /**
     * Creates a team under {@code parentId} (top level when null). The project's first team always includes the
     * creator, whatever {@code includeCreator} says, so nobody is left outside every team.
     */
    @Transactional
    public Squad create(UUID actor, UUID projectId, String name, String description, UUID parentId,
                        boolean includeCreator) {
        lockManager(actor, projectId);
        // Serializes team creation per project; the locked list also tells whether this is the first team.
        List<Squad> existing = teams.lockActiveProjectTeams(projectId);
        UUID parent = null;
        if (parentId != null) {
            parent = existing.stream().filter(team -> team.getId().equals(parentId)).map(Squad::getId).findFirst()
                    .orElseThrow(() -> new NoSuchElementException("Team not found"));
        }
        Squad team = Squad.create(projectId, name, description, actor);
        if (parent != null) team.moveUnder(parent, actor);
        Squad saved = teams.saveAndFlush(team);
        if (existing.isEmpty() || includeCreator) {
            ProjectMemberView self = projects.member(projectId, actor);
            if (self == null) throw new AccessDeniedException("Project access denied");
            teamMembers.saveAndFlush(SquadMembership.add(saved.getId(), self.membershipId(), actor));
        }
        return saved;
    }

    @Transactional(readOnly = true)
    public Page<Squad> list(UUID actor, UUID projectId, Pageable pageable) {
        requireMember(actor, projectId);
        return teams.findByProjectIdAndArchivedAtIsNull(projectId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<TeamView> listTeams(UUID actor, UUID projectId, Pageable pageable) {
        requireMember(actor, projectId);
        Page<Squad> page = teams.findByProjectIdAndArchivedAtIsNull(projectId, pageable);
        Map<UUID, TeamView> views = views(projectId, page.getContent());
        return page.map(team -> views.get(team.getId()));
    }

    @Transactional(readOnly = true)
    public TeamView detail(UUID actor, UUID projectId, UUID teamId) {
        requireMember(actor, projectId);
        return view(projectId, activeTeam(projectId, teamId));
    }

    @Transactional
    public TeamView update(UUID actor, UUID projectId, UUID teamId, String name, String description) {
        lockManager(actor, projectId);
        Squad team = activeTeam(projectId, teamId);
        team.updateDetails(name, description, actor);
        return view(projectId, teams.save(team));
    }

    /** A {@code null} {@code parentId} moves the team to the top level. */
    @Transactional
    public TeamView move(UUID actor, UUID projectId, UUID teamId, UUID parentId) {
        lockManager(actor, projectId);
        List<Squad> locked = teams.lockActiveProjectTeams(projectId);
        Map<UUID, Squad> byId = locked.stream().collect(Collectors.toMap(Squad::getId, team -> team));
        Squad team = byId.get(teamId);
        if (team == null || (parentId != null && !byId.containsKey(parentId)))
            throw new NoSuchElementException("Team not found");
        UUID cursor = parentId;
        while (cursor != null) {
            if (cursor.equals(teamId))
                throw new SquadConflictException("Circular team hierarchy", SquadConflictException.CIRCULAR_PARENT);
            Squad ancestor = byId.get(cursor);
            cursor = ancestor == null ? null : ancestor.getParentSquadId();
        }
        team.moveUnder(parentId, actor);
        return view(projectId, teams.save(team));
    }

    @Transactional
    public void archive(UUID actor, UUID projectId, UUID teamId) {
        deleteTeam(actor, projectId, teamId);
    }

    @Transactional
    public void deleteTeam(UUID actor, UUID projectId, UUID teamId) {
        com.pda.project.ProjectTeamContext context = lockManager(actor, projectId);
        teams.lockActiveProjectTeams(projectId);
        Squad team = activeTeam(projectId, teamId);
        if (teams.existsByParentSquadIdAndArchivedAtIsNull(teamId))
            throw new SquadConflictException("Move or delete child teams first", SquadConflictException.HAS_CHILDREN);
        Set<UUID> orphaned = new HashSet<>(teamMembers.findMembershipsOnlyIn(teamId));
        if (!orphaned.isEmpty()) {
            List<String> names = projects.membersByIds(projectId, orphaned).values().stream()
                    .map(view -> view.nickname() == null ? view.email() : view.nickname()).sorted().toList();
            throw new SquadConflictException("Archiving would leave members without a team",
                    SquadConflictException.ARCHIVE_WOULD_ORPHAN, names);
        }
        Set<UUID> memberIds = new HashSet<>(teamMembers.membershipIds(teamId));
        Set<UUID> recipients = projects.membersByIds(projectId, memberIds).values().stream()
                .map(ProjectMemberView::userId).filter(id -> !id.equals(actor)).collect(Collectors.toSet());
        String actorName = users.findActiveById(actor).map(UserAccounts.AuthenticatedUser::nickname).orElse(null);
        var event = new SquadLifecycleEvents.TeamDeleted(UUID.randomUUID(), projectId, context.name(),
                teamId, team.getName(), actor, actorName, recipients, Instant.now());
        // The existing rows and task pool target remain historical references.
        projects.cancelPendingInvitationsForTeam(projectId, teamId);
        team.archive(actor);
        teams.save(team);
        events.publishEvent(event);
    }

    @Transactional(readOnly = true)
    public Page<SquadMemberSummary> listMembers(UUID actor, UUID projectId, UUID teamId, Pageable pageable) {
        requireMember(actor, projectId);
        activeTeam(projectId, teamId);
        Page<SquadMembership> page = teamMembers.findBySquadId(teamId, pageable);
        Set<UUID> ids = page.getContent().stream().map(SquadMembership::getProjectMembershipId)
                .collect(Collectors.toSet());
        Map<UUID, ProjectMemberView> views = ids.isEmpty() ? Map.of() : projects.membersByIds(projectId, ids);
        Map<UUID, List<TeamRef>> others = otherTeams(ids, teamId);
        // E-mail addresses are for people who manage the members; everybody else sees nicknames only.
        boolean seesEmail = projects.hasPermission(projectId, actor, ProjectPermission.MEMBER_MANAGE);
        return page.map(row -> {
            ProjectMemberView view = views.get(row.getProjectMembershipId());
            if (view == null) throw new IllegalStateException("Team has stale project membership");
            return new SquadMemberSummary(view.userId(), view.nickname(), seesEmail ? view.email() : null, view.roles(),
                    row.getAddedBy(), row.getAddedAt(),
                    others.getOrDefault(row.getProjectMembershipId(), List.of()), view.profilePhotoVersion());
        });
    }

    @Transactional
    public SquadMemberSummary addMember(UUID actor, UUID projectId, UUID teamId, UUID userId) {
        lockManager(actor, projectId);
        Squad team = activeTeam(projectId, teamId);
        ProjectMemberView view = projects.member(projectId, userId);
        if (view == null) throw new NoSuchElementException("Active project member not found");
        if (teamMembers.existsBySquadIdAndProjectMembershipId(teamId, view.membershipId()))
            throw new SquadConflictException("User is already a team member", SquadConflictException.MEMBER_EXISTS);
        SquadMembership saved = teamMembers.saveAndFlush(SquadMembership.add(teamId, view.membershipId(), actor));
        team.touch(actor);
        teams.save(team);
        events.publishEvent(new SquadMembershipEvents.MemberAdded(teamId, projectId, userId, actor, Instant.now()));
        return new SquadMemberSummary(userId, view.nickname(), view.email(), view.roles(),
                saved.getAddedBy(), saved.getAddedAt(),
                otherTeams(Set.of(view.membershipId()), teamId).getOrDefault(view.membershipId(), List.of()),
                view.profilePhotoVersion());
    }

    /** A member's last team cannot be left: that would be removing them from the project, which is a separate act. */
    @Transactional
    public void removeMember(UUID actor, UUID projectId, UUID teamId, UUID userId) {
        lockManager(actor, projectId);
        Squad team = activeTeam(projectId, teamId);
        ProjectMemberView view = projects.member(projectId, userId);
        if (view == null) throw new NoSuchElementException("Active project member not found");
        SquadMembership membership = teamMembers.findBySquadIdAndProjectMembershipId(teamId, view.membershipId())
                .orElseThrow(() -> new NoSuchElementException("Team member not found"));
        if (teamMembers.countActiveTeamsOf(view.membershipId()) <= 1)
            throw new SquadConflictException("A member must stay in at least one team",
                    SquadConflictException.LAST_MEMBERSHIP);
        teamMembers.delete(membership);
        team.touch(actor);
        teams.save(team);
        events.publishEvent(new SquadMembershipEvents.MemberRemoved(teamId, projectId, userId, actor, Instant.now()));
    }

    /** Who can be added to this team: project members directly, everyone else through an invitation. */
    @Transactional(readOnly = true)
    public List<TeamCandidate> candidates(UUID actor, UUID projectId, UUID teamId, String query) {
        requireManager(actor, projectId);
        activeTeam(projectId, teamId);
        String text = query == null ? "" : query.strip();
        if (text.length() < CANDIDATE_MIN_QUERY) return List.of();
        List<UserAccounts.UserSearchResult> found = users.searchActiveUsers(text, CANDIDATE_LIMIT);
        if (found.isEmpty()) return List.of();
        Set<UUID> userIds = found.stream().map(UserAccounts.UserSearchResult::userId).collect(Collectors.toSet());
        Map<UUID, UUID> membershipByUser = projects.activeMembershipIds(projectId, userIds);
        Set<UUID> inTeam = membershipByUser.isEmpty() ? Set.of()
                : new HashSet<>(teamMembers.findMembershipIdsInTeam(teamId, membershipByUser.values()));
        Set<UUID> invited = projects.pendingInviteeIds(projectId, userIds);
        return found.stream().map(user -> {
            UUID membershipId = membershipByUser.get(user.userId());
            TeamCandidate.Status status = membershipId != null
                    ? (inTeam.contains(membershipId) ? TeamCandidate.Status.TEAM_MEMBER
                            : TeamCandidate.Status.PROJECT_MEMBER)
                    : (invited.contains(user.userId()) ? TeamCandidate.Status.INVITED : TeamCandidate.Status.NONE);
            return new TeamCandidate(user.userId(), user.nickname(), status);
        }).toList();
    }

    private TeamView view(UUID projectId, Squad team) {
        return views(projectId, List.of(team)).get(team.getId());
    }

    /** Fixed number of queries however many teams are listed: counts, newest members, names, updaters. */
    private Map<UUID, TeamView> views(UUID projectId, Collection<Squad> listed) {
        if (listed.isEmpty()) return Map.of();
        Set<UUID> ids = listed.stream().map(Squad::getId).collect(Collectors.toSet());
        Map<UUID, Long> counts = new HashMap<>();
        for (Object[] row : teamMembers.countByTeamIds(ids)) counts.put((UUID) row[0], (Long) row[1]);

        Map<UUID, List<UUID>> newestMembershipIds = new HashMap<>();
        Map<UUID, Instant> joinedAt = new HashMap<>();
        for (Object[] row : teamMembers.findNewestMembers(ids, PREVIEW_SIZE)) {
            UUID membershipId = (UUID) row[1];
            newestMembershipIds.computeIfAbsent((UUID) row[0], key -> new ArrayList<>()).add(membershipId);
            joinedAt.put(membershipId, toInstant(row[2]));
        }
        Set<UUID> membershipIds = newestMembershipIds.values().stream().flatMap(List::stream)
                .collect(Collectors.toSet());
        Map<UUID, ProjectMemberView> memberViews = membershipIds.isEmpty() ? Map.of()
                : projects.membersByIds(projectId, membershipIds);
        Map<UUID, UserAccounts.ProfileSummary> profiles = users.findActiveProfilesByIds(memberViews.values().stream()
                .map(ProjectMemberView::userId).collect(Collectors.toSet()));
        Map<UUID, UserAccounts.AuthenticatedUser> updaters = users.findActiveByIds(
                listed.stream().map(Squad::getUpdatedBy).collect(Collectors.toSet()));

        Map<UUID, TeamView> result = new HashMap<>();
        for (Squad team : listed) {
            List<MemberPreview> preview = new ArrayList<>();
            LastJoined lastJoined = null;
            for (UUID membershipId : newestMembershipIds.getOrDefault(team.getId(), List.of())) {
                ProjectMemberView member = memberViews.get(membershipId);
                if (member == null) continue;
                var profile = profiles.get(member.userId());
                preview.add(new MemberPreview(member.userId(), member.nickname(), member.profilePhotoVersion(),
                        profile == null ? null : profile.firstName(), profile == null ? null : profile.lastName()));
                if (lastJoined == null)
                    lastJoined = new LastJoined(member.userId(), member.nickname(), joinedAt.get(membershipId));
            }
            UserAccounts.AuthenticatedUser updater = updaters.get(team.getUpdatedBy());
            result.put(team.getId(), new TeamView(team, counts.getOrDefault(team.getId(), 0L),
                    new UserRef(team.getUpdatedBy(), updater == null ? null : updater.nickname(),
                            updater == null ? null : updater.profilePhotoVersion()),
                    preview, lastJoined));
        }
        return result;
    }

    /** Each membership's other active teams, in one query plus one name lookup. */
    private Map<UUID, List<TeamRef>> otherTeams(Collection<UUID> membershipIds, UUID exceptTeamId) {
        if (membershipIds.isEmpty()) return Map.of();
        List<Object[]> rows = teamMembers.findActiveTeamsOf(membershipIds);
        Set<UUID> teamIds = rows.stream().map(row -> (UUID) row[1]).filter(id -> !id.equals(exceptTeamId))
                .collect(Collectors.toSet());
        if (teamIds.isEmpty()) return Map.of();
        Map<UUID, String> names = teams.findAllById(teamIds).stream()
                .collect(Collectors.toMap(Squad::getId, Squad::getName));
        Map<UUID, List<TeamRef>> result = new HashMap<>();
        for (Object[] row : rows) {
            UUID teamId = (UUID) row[1];
            if (teamId.equals(exceptTeamId) || !names.containsKey(teamId)) continue;
            result.computeIfAbsent((UUID) row[0], key -> new ArrayList<>()).add(new TeamRef(teamId, names.get(teamId)));
        }
        result.values().forEach(list -> list.sort(Comparator.comparing(TeamRef::name)));
        return result;
    }

    /** Native timestamptz columns surface as different types depending on the driver and Hibernate version. */
    private static Instant toInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof OffsetDateTime offset) return offset.toInstant();
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof java.util.Date date) return date.toInstant();
        throw new IllegalStateException("Unexpected timestamp type " + value.getClass().getName());
    }

    private Squad activeTeam(UUID projectId, UUID teamId) {
        if (teamId == null) throw new IllegalArgumentException("teamId is required");
        return teams.findByIdAndArchivedAtIsNull(teamId)
                .filter(team -> team.getProjectId().equals(projectId))
                .orElseThrow(() -> new NoSuchElementException("Team not found"));
    }
    private void requireMember(UUID actor, UUID projectId) {
        if (actor == null || projectId == null || !projects.isMember(projectId, actor))
            throw new AccessDeniedException("Project access denied");
    }
    private void requireManager(UUID actor, UUID projectId) {
        requireMember(actor, projectId);
        if (!projects.hasPermission(projectId, actor, ProjectPermission.SQUAD_MANAGE))
            throw new AccessDeniedException("Team management denied");
    }

    private com.pda.project.ProjectTeamContext lockManager(UUID actor, UUID projectId) {
        requireManager(actor, projectId);
        var context = projects.lockTeamContext(projectId);
        if (context == null) throw new NoSuchElementException("Project not found");
        requireManager(actor, projectId);
        return context;
    }
}
