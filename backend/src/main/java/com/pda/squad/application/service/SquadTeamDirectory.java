package com.pda.squad.application.service;

import com.pda.project.ProjectAccess;
import com.pda.project.ProjectTeamDirectory;
import com.pda.squad.domain.entity.Squad;
import com.pda.squad.infrastructure.repository.SquadMembershipRepository;
import com.pda.squad.infrastructure.repository.SquadRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Squad-side implementation of the Project module's {@link ProjectTeamDirectory} port. */
@Component
class SquadTeamDirectory implements ProjectTeamDirectory {

    private final SquadRepository teams;
    private final SquadMembershipRepository memberships;
    private final ProjectAccess projects;

    SquadTeamDirectory(SquadRepository teams, SquadMembershipRepository memberships, ProjectAccess projects) {
        this.teams = teams;
        this.memberships = memberships;
        this.projects = projects;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isActiveTeam(UUID projectId, UUID teamId) {
        if (projectId == null || teamId == null) return false;
        return teams.findByIdAndArchivedAtIsNull(teamId)
                .filter(team -> team.getProjectId().equals(projectId)).isPresent();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isActiveTeamMember(UUID projectId, UUID teamId, UUID userId) {
        if (userId == null || !isActiveTeam(projectId, teamId)) return false;
        UUID membershipId = projects.activeMembershipIds(projectId, Set.of(userId)).get(userId);
        return membershipId != null && memberships.existsBySquadIdAndProjectMembershipId(teamId, membershipId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> teamNames(Set<UUID> teamIds) {
        Map<UUID, String> names = new HashMap<>();
        if (teamIds == null || teamIds.isEmpty()) return names;
        for (Squad team : teams.findAllById(teamIds)) names.put(team.getId(), team.getName());
        return names;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> activeTeamIds(Set<UUID> teamIds) {
        Set<UUID> active = new HashSet<>();
        if (teamIds == null || teamIds.isEmpty()) return active;
        for (Squad team : teams.findAllById(teamIds)) if (team.getArchivedAt() == null) active.add(team.getId());
        return active;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> activeTeamIdsOfUser(UUID projectId, UUID userId) {
        Set<UUID> result = new HashSet<>();
        if (projectId == null || userId == null) return result;
        UUID membershipId = projects.activeMembershipIds(projectId, Set.of(userId)).get(userId);
        if (membershipId == null) return result;
        for (Object[] row : memberships.findActiveTeamsOf(Set.of(membershipId))) result.add((UUID) row[1]);
        return result;
    }
}
