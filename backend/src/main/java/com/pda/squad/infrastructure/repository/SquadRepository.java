package com.pda.squad.infrastructure.repository;

import com.pda.squad.domain.entity.Squad;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SquadRepository extends JpaRepository<Squad, UUID> {

    Optional<Squad> findByIdAndArchivedAtIsNull(UUID id);

    Page<Squad> findByProjectIdAndArchivedAtIsNull(UUID projectId, Pageable pageable);

    long countByProjectIdAndArchivedAtIsNull(UUID projectId);
}
