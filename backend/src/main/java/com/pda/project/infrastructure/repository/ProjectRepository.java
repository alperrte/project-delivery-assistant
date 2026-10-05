package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.Project;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Project p where p.id = :projectId")
    Optional<Project> lockTaskPolicy(@Param("projectId") UUID projectId);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select p from Project p where p.id = :projectId")
    Optional<Project> lockTaskContext(@Param("projectId") UUID projectId);

    boolean existsBySlug(String slug);

    long countByArchivedAtIsNull();

    Optional<Project> findBySlugAndArchivedAtIsNull(String slug);

    Optional<Project> findByIdAndArchivedAtIsNull(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Project p where p.id = :projectId and p.archivedAt is null")
    Optional<Project> lockActive(@Param("projectId") UUID projectId);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select p from Project p where p.id = :projectId and p.archivedAt is null")
    Optional<Project> lockActiveShared(@Param("projectId") UUID projectId);

    Page<Project> findByArchivedAtIsNull(Pageable pageable);

    Page<Project> findByOrganizationIdAndArchivedAtIsNull(UUID organizationId, Pageable pageable);

    @Query("select p from Project p where p.archivedAt is null and exists "
            + "(select 1 from ProjectMembership m where m.projectId = p.id and m.userId = :userId "
            + "and m.status = com.pda.project.domain.enums.MembershipStatus.ACTIVE)")
    Page<Project> findVisibleTo(@Param("userId") UUID userId, Pageable pageable);

    @Query("select p from Project p where p.organizationId = :organizationId and p.archivedAt is null "
            + "and exists (select 1 from ProjectMembership m where m.projectId = p.id and m.userId = :userId "
            + "and m.status = com.pda.project.domain.enums.MembershipStatus.ACTIVE)")
    Page<Project> findVisibleInOrganization(@Param("organizationId") UUID organizationId,
                                            @Param("userId") UUID userId, Pageable pageable);
}
