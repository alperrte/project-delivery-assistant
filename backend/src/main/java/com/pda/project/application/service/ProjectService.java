package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.domain.enums.ProjectRole;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.organization.application.OrganizationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

@Service
public class ProjectService {

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final OrganizationService organizations;

    public ProjectService(ProjectRepository projects, ProjectMembershipRepository memberships,
                          OrganizationService organizations) {
        this.projects = projects;
        this.memberships = memberships;
        this.organizations = organizations;
    }

    @Transactional
    public Project create(UUID actorId, String name, String description, UUID organizationId) {
        Objects.requireNonNull(actorId, "actorId is required");
        if (organizationId != null) {
            organizations.detail(actorId, organizationId);
        }
        Project project = projects.saveAndFlush(Project.create(name, SlugGenerator.generate(name),
                description, actorId, organizationId));
        memberships.saveAndFlush(ProjectMembership.initialManager(project.getId(), actorId));
        return project;
    }

    @Transactional(readOnly = true)
    public Page<Project> list(UUID actorId, Pageable pageable) {
        Objects.requireNonNull(actorId, "actorId is required");
        return projects.findVisibleTo(actorId, pageable);
    }

    @Transactional(readOnly = true)
    public Project detail(UUID actorId, UUID projectId) {
        requireMember(actorId, projectId);
        return activeProject(projectId);
    }

    @Transactional(readOnly = true)
    public Project detailBySlug(UUID actorId, String slug) {
        Project project = projects.findBySlugAndArchivedAtIsNull(slug)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
        requireMember(actorId, project.getId());
        return project;
    }

    @Transactional
    public Project update(UUID actorId, UUID projectId, String name, String description,
                          ProjectPriority priority, LocalDate startDate, LocalDate targetEndDate,
                          String projectGoal, String techStack, UUID organizationId) {
        requireManager(actorId, projectId);
        Project project = activeProject(projectId);
        if (organizationId != null) {
            organizations.detail(actorId, organizationId);
        }
        project.updateDetails(name, description, priority, startDate, targetEndDate,
                projectGoal, techStack, organizationId);
        return projects.save(project);
    }

    @Transactional
    public void archive(UUID actorId, UUID projectId) {
        requireManager(actorId, projectId);
        Project project = activeProject(projectId);
        project.archive();
        projects.save(project);
    }

    @Transactional(readOnly = true)
    public Page<Project> visibleInOrganization(UUID actorId, UUID organizationId, Pageable pageable) {
        Objects.requireNonNull(actorId, "actorId is required");
        organizations.requireActive(organizationId);
        return projects.findVisibleInOrganization(organizationId, actorId, pageable);
    }

    private Project activeProject(UUID projectId) {
        return projects.findByIdAndArchivedAtIsNull(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
    }

    private ProjectMembership requireMember(UUID actorId, UUID projectId) {
        Objects.requireNonNull(actorId, "actorId is required");
        Objects.requireNonNull(projectId, "projectId is required");
        return memberships.findByProjectIdAndUserId(projectId, actorId)
                .orElseThrow(() -> new AccessDeniedException("Project access denied"));
    }

    private void requireManager(UUID actorId, UUID projectId) {
        if (!requireMember(actorId, projectId).hasRole(ProjectRole.PROJECT_MANAGER)) {
            throw new AccessDeniedException("Project management denied");
        }
    }
}
