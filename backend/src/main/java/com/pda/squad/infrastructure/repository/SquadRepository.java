package com.pda.squad.infrastructure.repository;

import com.pda.squad.domain.entity.Squad;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import java.util.List;

import java.util.Optional;
import java.util.UUID;

public interface SquadRepository extends JpaRepository<Squad, UUID> {

    Optional<Squad> findByIdAndArchivedAtIsNull(UUID id);

    Page<Squad> findByProjectIdAndArchivedAtIsNull(UUID projectId, Pageable pageable);

    long countByProjectIdAndArchivedAtIsNull(UUID projectId);

    boolean existsByParentSquadIdAndArchivedAtIsNull(UUID parentSquadId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Squad s where s.projectId = :projectId and s.archivedAt is null order by s.id")
    List<Squad> lockActiveProjectTeams(UUID projectId);
}
