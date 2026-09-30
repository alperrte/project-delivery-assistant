package com.pda.squad.application.service;

import com.pda.project.ProjectAccess;
import com.pda.project.ProjectCreatedEvent;
import com.pda.project.ProjectMemberView;
import com.pda.project.ProjectMembershipEvents;
import com.pda.squad.SquadMembershipEvents;
import com.pda.squad.domain.entity.Squad;
import com.pda.squad.domain.entity.SquadMembership;
import com.pda.squad.infrastructure.repository.SquadMembershipRepository;
import com.pda.squad.infrastructure.repository.SquadRepository;
import com.pda.user.ProjectPermission;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/** Project-scoped organization only. ProjectMembership remains the authority for access and roles. */
@Service
public class SquadService {
    private final ProjectAccess projects;
    private final SquadRepository teams;
    private final SquadMembershipRepository teamMembers;
    private final ApplicationEventPublisher events;

    public SquadService(ProjectAccess projects, SquadRepository teams,
                        SquadMembershipRepository teamMembers, ApplicationEventPublisher events) {
        this.projects = projects; this.teams = teams; this.teamMembers = teamMembers; this.events = events;
    }

    /** Runs synchronously inside ProjectService.create's transaction, so root and project commit together. */
    @EventListener
    @Transactional
    public void projectCreated(ProjectCreatedEvent event) {
        teams.saveAndFlush(Squad.general(event.projectId(), event.creatorUserId()));
    }

    @EventListener
    @Transactional
    public void projectMemberRemoved(ProjectMembershipEvents.MemberRemoved event) {
        teamMembers.deleteByProjectMembershipId(event.membershipId());
    }

    @Transactional
    public Squad create(UUID actor, UUID projectId, String name, String description) {
        return create(actor, projectId, name, description, null);
    }

    @Transactional
    public Squad create(UUID actor, UUID projectId, String name, String description, UUID parentId) {
        requireManager(actor, projectId);
        UUID parent = parentId == null ? general(projectId).getId() : activeTeam(projectId, parentId).getId();
        Squad team = Squad.create(projectId, name, description, actor);
        team.moveUnder(parent);
        return teams.saveAndFlush(team);
    }

    /** Legacy /squads listing excludes the newly introduced General Team. */
    @Transactional(readOnly = true)
    public Page<Squad> list(UUID actor, UUID projectId, Pageable pageable) {
        requireMember(actor, projectId);
        return teams.findByProjectIdAndGeneralFalseAndArchivedAtIsNull(projectId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<Squad> listTeams(UUID actor, UUID projectId, Pageable pageable) {
        requireMember(actor, projectId);
        return teams.findByProjectIdAndArchivedAtIsNull(projectId, pageable);
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> memberCounts(UUID actor, UUID projectId, Collection<Squad> listedTeams) {
        requireMember(actor, projectId);
        Map<UUID, Long> counts = new HashMap<>();
        Set<UUID> customIds = listedTeams.stream().filter(team -> !team.isGeneral())
                .map(Squad::getId).collect(Collectors.toSet());
        if (!customIds.isEmpty()) for (Object[] row : teamMembers.countByTeamIds(customIds))
            counts.put((UUID) row[0], (Long) row[1]);
        for (Squad team : listedTeams) if (team.isGeneral())
            counts.put(team.getId(), projects.members(projectId, PageRequest.of(0, 1)).getTotalElements());
        return counts;
    }

    @Transactional(readOnly = true)
    public Squad detail(UUID actor, UUID projectId, UUID teamId) {
        requireMember(actor, projectId);
        return activeTeam(projectId, teamId);
    }

    @Transactional
    public Squad update(UUID actor, UUID projectId, UUID teamId, String name, String description) {
        requireManager(actor, projectId);
        Squad team = activeTeam(projectId, teamId);
        if (team.isGeneral()) throw new SquadConflictException("General Team cannot be renamed");
        team.updateDetails(name, description);
        return teams.save(team);
    }

    @Transactional
    public Squad move(UUID actor, UUID projectId, UUID teamId, UUID parentId) {
        requireManager(actor, projectId);
        List<Squad> locked = teams.lockActiveProjectTeams(projectId);
        Map<UUID, Squad> byId = locked.stream().collect(Collectors.toMap(Squad::getId, team -> team));
        Squad team = byId.get(teamId);
        Squad parent = byId.get(parentId);
        if (team == null || parent == null) throw new NoSuchElementException("Team not found");
        if (team.isGeneral()) throw new SquadConflictException("General Team cannot be moved");
        UUID cursor = parentId;
        while (cursor != null) {
            if (cursor.equals(teamId)) throw new SquadConflictException("Circular team hierarchy");
            Squad ancestor = byId.get(cursor);
            cursor = ancestor == null ? null : ancestor.getParentSquadId();
        }
        team.moveUnder(parentId);
        return teams.save(team);
    }

    @Transactional
    public void archive(UUID actor, UUID projectId, UUID teamId) {
        requireManager(actor, projectId);
        Squad team = activeTeam(projectId, teamId);
        if (team.isGeneral()) throw new SquadConflictException("General Team cannot be deleted");
        if (teams.existsByParentSquadIdAndArchivedAtIsNull(teamId))
            throw new SquadConflictException("Move or delete child teams first");
        team.archive();
        teams.save(team);
    }

    @Transactional(readOnly = true)
    public Page<SquadMemberSummary> listMembers(UUID actor, UUID projectId, UUID teamId, Pageable pageable) {
        requireMember(actor, projectId);
        Squad team = activeTeam(projectId, teamId);
        if (team.isGeneral()) {
            Pageable membershipPage = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                    org.springframework.data.domain.Sort.by("joinedAt").ascending());
            return projects.members(projectId, membershipPage).map(view ->
                    new SquadMemberSummary(view.userId(), view.nickname(), view.email(), view.roles(),
                            null, view.joinedAt()));
        }
        Page<SquadMembership> page = teamMembers.findBySquadId(teamId, pageable);
        Set<UUID> ids = page.getContent().stream().map(SquadMembership::getProjectMembershipId)
                .collect(Collectors.toSet());
        Map<UUID, ProjectMemberView> views = projects.membersByIds(projectId, ids);
        return page.map(row -> {
            ProjectMemberView view = views.get(row.getProjectMembershipId());
            if (view == null) throw new IllegalStateException("Team has stale project membership");
            return new SquadMemberSummary(view.userId(), view.nickname(), view.email(), view.roles(),
                    row.getAddedBy(), row.getAddedAt());
        });
    }

    @Transactional
    public SquadMemberSummary addMember(UUID actor, UUID projectId, UUID teamId, UUID userId) {
        requireManager(actor, projectId);
        Squad team = activeTeam(projectId, teamId);
        if (team.isGeneral()) throw new SquadConflictException("General Team includes all project members automatically");
        ProjectMemberView view = projects.member(projectId, userId);
        if (view == null) throw new NoSuchElementException("Active project member not found");
        if (teamMembers.existsBySquadIdAndProjectMembershipId(teamId, view.membershipId()))
            throw new SquadConflictException("User is already a team member");
        SquadMembership saved = teamMembers.saveAndFlush(SquadMembership.add(teamId, view.membershipId(), actor));
        events.publishEvent(new SquadMembershipEvents.MemberAdded(teamId, projectId, userId, actor, Instant.now()));
        return new SquadMemberSummary(userId, view.nickname(), view.email(), view.roles(),
                saved.getAddedBy(), saved.getAddedAt());
    }

    @Transactional
    public void removeMember(UUID actor, UUID projectId, UUID teamId, UUID userId) {
        requireManager(actor, projectId);
        Squad team = activeTeam(projectId, teamId);
        if (team.isGeneral()) throw new SquadConflictException("General Team membership follows project membership");
        ProjectMemberView view = projects.member(projectId, userId);
        if (view == null) throw new NoSuchElementException("Active project member not found");
        SquadMembership membership = teamMembers.findBySquadIdAndProjectMembershipId(teamId, view.membershipId())
                .orElseThrow(() -> new NoSuchElementException("Team member not found"));
        teamMembers.delete(membership);
        events.publishEvent(new SquadMembershipEvents.MemberRemoved(teamId, projectId, userId, actor, Instant.now()));
    }

    private Squad general(UUID projectId) {
        return teams.findByProjectIdAndGeneralTrue(projectId)
                .orElseThrow(() -> new IllegalStateException("General Team is missing"));
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
}
