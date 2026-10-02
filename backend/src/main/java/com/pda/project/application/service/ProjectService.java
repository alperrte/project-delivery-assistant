package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;
import com.pda.project.ProjectCreatedEvent;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.domain.enums.ProjectStatus;
import com.pda.project.domain.enums.ProjectType;
import com.pda.user.ProjectPermission;
import com.pda.user.RolePolicy;
import com.pda.user.UserAccounts;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.organization.application.OrganizationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectService {

    private static final int CARD_PREVIEW_MEMBERS = 5;

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final OrganizationService organizations;
    private final ApplicationEventPublisher events;
    private final UserAccounts users;

    public ProjectService(ProjectRepository projects, ProjectMembershipRepository memberships,
                          OrganizationService organizations, ApplicationEventPublisher events,
                          UserAccounts users) {
        this.projects = projects;
        this.memberships = memberships;
        this.organizations = organizations;
        this.events = events;
        this.users = users;
    }

    @Transactional
    public Project create(UUID actorId, String name, String description, UUID organizationId) {
        return create(actorId, name, description, organizationId, null, null, null);
    }

    @Transactional
    public Project create(UUID actorId, String name, String description, UUID organizationId,
                          ProjectType projectType, String tagline, String techStack) {
        Objects.requireNonNull(actorId, "actorId is required");
        if (organizationId != null) {
            organizations.detail(actorId, organizationId);
        }
        Project project = projects.saveAndFlush(Project.create(name, SlugGenerator.generate(name),
                description, actorId, organizationId, projectType, tagline, techStack));
        memberships.saveAndFlush(ProjectMembership.initialManager(project.getId(), actorId));
        events.publishEvent(new ProjectCreatedEvent(project.getId(), actorId));
        return project;
    }

    @Transactional(readOnly = true)
    public Page<Project> list(UUID actorId, Pageable pageable) {
        Objects.requireNonNull(actorId, "actorId is required");
        return projects.findVisibleTo(actorId, pageable);
    }

    /** The list page plus per-project card data, using a fixed number of queries for the whole page. */
    @Transactional(readOnly = true)
    public Page<ProjectCardView> listCards(UUID actorId, Pageable pageable) {
        Page<Project> page = list(actorId, pageable);
        List<Project> content = page.getContent();
        if (content.isEmpty()) {
            return page.map(project -> new ProjectCardView(project, 0, List.of(), null, false));
        }
        List<UUID> projectIds = content.stream().map(Project::getId).toList();

        Map<UUID, Integer> counts = new HashMap<>();
        for (Object[] row : memberships.countActiveByProjectIds(projectIds)) {
            counts.put((UUID) row[0], ((Number) row[1]).intValue());
        }
        Map<UUID, List<UUID>> previewIds = new HashMap<>();
        Set<UUID> userIds = new HashSet<>();
        for (Object[] row : memberships.findPreviewMembers(projectIds, CARD_PREVIEW_MEMBERS)) {
            UUID projectId = (UUID) row[0];
            UUID userId = (UUID) row[1];
            previewIds.computeIfAbsent(projectId, key -> new ArrayList<>()).add(userId);
            userIds.add(userId);
        }
        content.stream().map(Project::getUpdatedBy).filter(Objects::nonNull).forEach(userIds::add);
        Map<UUID, UserAccounts.AuthenticatedUser> accounts = users.findActiveByIds(userIds);
        Set<UUID> editable = new HashSet<>();
        for (ProjectMembership membership : memberships.findActiveByUser(actorId)) {
            if (RolePolicy.allows(membership.getRoles(), ProjectPermission.PROJECT_UPDATE)) {
                editable.add(membership.getProjectId());
            }
        }

        return page.map(project -> new ProjectCardView(project,
                counts.getOrDefault(project.getId(), 0),
                previewIds.getOrDefault(project.getId(), List.of()).stream()
                        .filter(accounts::containsKey)
                        .map(id -> new ProjectCardView.Person(id, accounts.get(id).nickname(),
                                accounts.get(id).profilePhotoVersion()))
                        .toList(),
                person(accounts, project.getUpdatedBy()),
                editable.contains(project.getId())));
    }

    private static ProjectCardView.Person person(Map<UUID, UserAccounts.AuthenticatedUser> accounts, UUID userId) {
        UserAccounts.AuthenticatedUser account = userId == null ? null : accounts.get(userId);
        return account == null ? null : new ProjectCardView.Person(account.id(), account.nickname(), account.profilePhotoVersion());
    }

    @Transactional(readOnly = true)
    public Project detail(UUID actorId, UUID projectId) {
        require(actorId, projectId, ProjectPermission.PROJECT_VIEW);
        return activeProject(projectId);
    }

    @Transactional(readOnly = true)
    public Project detailBySlug(UUID actorId, String slug) {
        Project project = projects.findBySlugAndArchivedAtIsNull(slug)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
        require(actorId, project.getId(), ProjectPermission.PROJECT_VIEW);
        return project;
    }

    @Transactional
    public Project update(UUID actorId, UUID projectId, String name, String description,
                          ProjectPriority priority, ProjectStatus status, LocalDate startDate,
                          LocalDate targetEndDate, String projectGoal, String techStack, UUID organizationId) {
        return update(actorId, projectId, name, description, priority, status, startDate, targetEndDate,
                projectGoal, techStack, organizationId, null, null);
    }

    @Transactional
    public Project update(UUID actorId, UUID projectId, String name, String description,
                          ProjectPriority priority, ProjectStatus status, LocalDate startDate,
                          LocalDate targetEndDate, String projectGoal, String techStack, UUID organizationId,
                          ProjectType projectType, String tagline) {
        require(actorId, projectId, ProjectPermission.PROJECT_UPDATE);
        Project project = activeProject(projectId);
        // Ownership is checked when the project is linked to an organization, not on every save: a co-manager who
        // is not the organization's owner must still be able to edit a project that is already linked to it.
        if (organizationId != null && !organizationId.equals(project.getOrganizationId())) {
            organizations.detail(actorId, organizationId);
        }
        if (status != null && status != project.getStatus()) {
            project.changeStatus(status);
        }
        project.updateDetails(name, description, priority, startDate, targetEndDate,
                projectGoal, techStack, organizationId);
        project.updateIdentity(projectType, tagline);
        project.touch(actorId);
        return projects.save(project);
    }

    @Transactional
    public void archive(UUID actorId, UUID projectId) {
        require(actorId, projectId, ProjectPermission.PROJECT_ARCHIVE);
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
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, actorId, MembershipStatus.ACTIVE)
                .orElseThrow(() -> new AccessDeniedException("Project access denied"));
    }

    private void require(UUID actorId, UUID projectId, ProjectPermission permission) {
        if (!RolePolicy.allows(requireMember(actorId, projectId).getRoles(), permission)) {
            throw new AccessDeniedException("Project permission denied");
        }
    }
}
