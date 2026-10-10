package com.pda.project.organization.infrastructure;

import com.pda.project.organization.domain.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

import java.util.Optional;
import java.util.UUID;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Organization o where o.id = :id and o.archivedAt is null")
    Optional<Organization> lockActive(UUID id);

    boolean existsBySlug(String slug);

    Optional<Organization> findByIdAndArchivedAtIsNull(UUID id);

    Optional<Organization> findBySlugAndArchivedAtIsNull(String slug);

    Page<Organization> findByArchivedAtIsNull(Pageable pageable);

    Page<Organization> findByOwnerUserIdAndArchivedAtIsNull(UUID ownerUserId, Pageable pageable);

    java.util.List<Organization> findByOwnerUserIdAndArchivedAtIsNullOrderByNameAsc(UUID ownerUserId);
}
