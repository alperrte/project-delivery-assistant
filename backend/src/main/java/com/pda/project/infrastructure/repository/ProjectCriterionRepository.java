package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectCriterion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectCriterionRepository extends JpaRepository<ProjectCriterion, UUID> {

    List<ProjectCriterion> findByProjectIdOrderBySortOrderAsc(UUID projectId);

    Optional<ProjectCriterion> findByIdAndProjectId(UUID id, UUID projectId);

    long countByProjectId(UUID projectId);

    long countByProjectIdAndCompletedTrue(UUID projectId);

    @Query("select coalesce(max(c.sortOrder), -1) from ProjectCriterion c where c.projectId = :projectId")
    int findMaxSortOrder(@Param("projectId") UUID projectId);
}
