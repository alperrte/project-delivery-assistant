package com.pda.squad.application.service;

import com.pda.project.ProjectTeamDirectory;
import com.pda.squad.domain.entity.Squad;
import com.pda.squad.infrastructure.repository.SquadRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Squad-side implementation of the Project module's {@link ProjectTeamDirectory} port. */
@Component
class SquadTeamDirectory implements ProjectTeamDirectory {

    private final SquadRepository teams;

    SquadTeamDirectory(SquadRepository teams) {
        this.teams = teams;
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
    public Map<UUID, String> teamNames(Set<UUID> teamIds) {
        Map<UUID, String> names = new HashMap<>();
        if (teamIds == null || teamIds.isEmpty()) return names;
        for (Squad team : teams.findAllById(teamIds)) names.put(team.getId(), team.getName());
        return names;
    }
}
