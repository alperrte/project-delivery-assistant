package com.pda.squad.infrastructure.repository;

import com.pda.squad.domain.entity.SquadMembership;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SquadMembershipRepository extends JpaRepository<SquadMembership, UUID> {

    boolean existsBySquadIdAndUserId(UUID squadId, UUID userId);

    Optional<SquadMembership> findBySquadIdAndUserId(UUID squadId, UUID userId);

    Page<SquadMembership> findBySquadId(UUID squadId, Pageable pageable);

    long countBySquadId(UUID squadId);
}
