package com.pda.squad.infrastructure.repository;

import com.pda.squad.domain.entity.SquadMembership;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.Collection;
import java.util.UUID;

public interface SquadMembershipRepository extends JpaRepository<SquadMembership, UUID> {

    boolean existsBySquadIdAndProjectMembershipId(UUID squadId, UUID projectMembershipId);

    Optional<SquadMembership> findBySquadIdAndProjectMembershipId(UUID squadId, UUID projectMembershipId);

    long deleteByProjectMembershipId(UUID projectMembershipId);

    Page<SquadMembership> findBySquadId(UUID squadId, Pageable pageable);

    long countBySquadId(UUID squadId);

    @Query("select m.squadId, count(m) from SquadMembership m where m.squadId in :teamIds group by m.squadId")
    java.util.List<Object[]> countByTeamIds(Collection<UUID> teamIds);
}
