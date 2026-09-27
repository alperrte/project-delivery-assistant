package com.pda.project.application.service;

import com.pda.project.domain.entity.ProjectCriterion;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.infrastructure.repository.ProjectCriterionRepository;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.RolePolicy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

/**
 * Project success-criteria use-cases (HMZ-PROJ-23): a project-level checklist, never a task, never itself a
 * progress calculation. Only {@link com.pda.user.ProjectPermission#CRITERIA_MANAGE} may mutate it.
 */
@Service
public class ProjectCriterionService {

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectCriterionRepository criteria;

    public ProjectCriterionService(ProjectRepository projects, ProjectMembershipRepository memberships,
                                   ProjectCriterionRepository criteria) {
        this.projects = projects;
        this.memberships = memberships;
        this.criteria = criteria;
    }

    @Transactional(readOnly = true)
    public List<ProjectCriterion> list(UUID actorId, UUID projectId) {
        requireMember(actorId, projectId);
        return criteria.findByProjectIdOrderBySortOrderAsc(projectId);
    }

    @Transactional
    public ProjectCriterion create(UUID actorId, UUID projectId, String title, String description) {
        requireCriteriaManager(actorId, projectId);
        int nextSortOrder = criteria.findMaxSortOrder(projectId) + 1;
        return criteria.saveAndFlush(ProjectCriterion.create(projectId, title, description, nextSortOrder, actorId));
    }

    @Transactional
    public ProjectCriterion update(UUID actorId, UUID projectId, UUID criterionId, String title,
                                   String description) {
        requireCriteriaManager(actorId, projectId);
        ProjectCriterion criterion = inProject(projectId, criterionId);
        criterion.updateDetails(title, description);
        return criteria.save(criterion);
    }

    @Transactional
    public void delete(UUID actorId, UUID projectId, UUID criterionId) {
        requireCriteriaManager(actorId, projectId);
        criteria.delete(inProject(projectId, criterionId));
    }

    @Transactional
    public ProjectCriterion complete(UUID actorId, UUID projectId, UUID criterionId) {
        requireCriteriaManager(actorId, projectId);
        ProjectCriterion criterion = inProject(projectId, criterionId);
        criterion.complete(actorId);
        return criteria.save(criterion);
    }

    @Transactional
    public ProjectCriterion uncomplete(UUID actorId, UUID projectId, UUID criterionId) {
        requireCriteriaManager(actorId, projectId);
        ProjectCriterion criterion = inProject(projectId, criterionId);
        criterion.uncomplete();
        return criteria.save(criterion);
    }

    /** Assigns sort order 0..n-1 by the given order; every criterion of the project must be listed exactly once. */
    @Transactional
    public List<ProjectCriterion> reorder(UUID actorId, UUID projectId, List<UUID> orderedCriterionIds) {
        requireCriteriaManager(actorId, projectId);
        Objects.requireNonNull(orderedCriterionIds, "orderedCriterionIds is required");
        List<ProjectCriterion> current = criteria.findByProjectIdOrderBySortOrderAsc(projectId);
        if (orderedCriterionIds.size() != current.size()
                || !current.stream().map(ProjectCriterion::getId).allMatch(orderedCriterionIds::contains)) {
            throw new IllegalArgumentException("orderedCriterionIds must list every criterion of the project exactly once");
        }
        for (ProjectCriterion criterion : current) {
            criterion.updateSortOrder(orderedCriterionIds.indexOf(criterion.getId()));
        }
        criteria.saveAllAndFlush(current);
        return criteria.findByProjectIdOrderBySortOrderAsc(projectId);
    }

    private ProjectCriterion inProject(UUID projectId, UUID criterionId) {
        Objects.requireNonNull(criterionId, "criterionId is required");
        return criteria.findByIdAndProjectId(criterionId, projectId)
                .orElseThrow(() -> new NoSuchElementException("Criterion not found"));
    }

    private ProjectMembership requireMember(UUID actorId, UUID projectId) {
        Objects.requireNonNull(actorId, "actorId is required");
        Objects.requireNonNull(projectId, "projectId is required");
        projects.findByIdAndArchivedAtIsNull(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, actorId, MembershipStatus.ACTIVE)
                .orElseThrow(() -> new AccessDeniedException("Project access denied"));
    }

    private void requireCriteriaManager(UUID actorId, UUID projectId) {
        if (!RolePolicy.allows(requireMember(actorId, projectId).getRoles(), ProjectPermission.CRITERIA_MANAGE)) {
            throw new AccessDeniedException("Project criteria management denied");
        }
    }
}
