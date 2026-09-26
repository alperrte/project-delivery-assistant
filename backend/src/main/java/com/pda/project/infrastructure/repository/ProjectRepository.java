package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.Project;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    boolean existsBySlug(String slug);

    Optional<Project> findBySlugAndArchivedAtIsNull(String slug);

    Optional<Project> findByIdAndArchivedAtIsNull(UUID id);

    Page<Project> findByArchivedAtIsNull(Pageable pageable);

    Page<Project> findByOrganizationIdAndArchivedAtIsNull(UUID organizationId, Pageable pageable);

    @Query("select p from Project p where p.archivedAt is null and exists "
            + "(select 1 from ProjectMembership m where m.projectId = p.id and m.userId = :userId)")
    Page<Project> findVisibleTo(@Param("userId") UUID userId, Pageable pageable);

    @Query("select p from Project p where p.organizationId = :organizationId and p.archivedAt is null "
            + "and exists (select 1 from ProjectMembership m where m.projectId = p.id and m.userId = :userId)")
    Page<Project> findVisibleInOrganization(@Param("organizationId") UUID organizationId,
                                            @Param("userId") UUID userId, Pageable pageable);
}
