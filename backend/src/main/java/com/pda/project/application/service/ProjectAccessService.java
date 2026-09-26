package com.pda.project.application.service;

import com.pda.project.ProjectAccess;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectAccessService implements ProjectAccess {

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;

    public ProjectAccessService(ProjectRepository projects, ProjectMembershipRepository memberships) {
        this.projects = projects;
        this.memberships = memberships;
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
}
