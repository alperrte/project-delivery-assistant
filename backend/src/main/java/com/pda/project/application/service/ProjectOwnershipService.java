package com.pda.project.application.service;

import com.pda.project.ProjectOwnership;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.organization.infrastructure.OrganizationRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectOwnershipService implements ProjectOwnership {

    private final ProjectRepository projects;
    private final OrganizationRepository organizations;

    public ProjectOwnershipService(ProjectRepository projects, OrganizationRepository organizations) {
        this.projects = projects;
        this.organizations = organizations;
    }

    @Override
    @Transactional(readOnly = true)
    public List<OwnedResource> ownedBy(UUID userId) {
        List<OwnedResource> owned = new ArrayList<>();
        projects.findByCreatedByAndArchivedAtIsNullOrderByNameAsc(userId).forEach(project ->
                owned.add(new OwnedResource(Kind.PROJECT, project.getId(), project.getName(), project.getSlug())));
        organizations.findByOwnerUserIdAndArchivedAtIsNullOrderByNameAsc(userId).forEach(organization ->
                owned.add(new OwnedResource(Kind.ORGANIZATION, organization.getId(), organization.getName(),
                        organization.getSlug())));
        return owned;
    }
}
