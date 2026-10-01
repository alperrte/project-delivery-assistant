package com.pda.squad.infrastructure.repository;

import com.pda.squad.domain.entity.SquadMembership;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /** Newest members first; the first {@code limit} rows per team as {@code [squad_id, project_membership_id, added_at]}. */
    @Query(value = "select t.squad_id, t.project_membership_id, t.added_at from ("
            + "select m.squad_id, m.project_membership_id, m.added_at, row_number() over "
            + "(partition by m.squad_id order by m.added_at desc, m.id) as rn "
            + "from squad_members m where m.squad_id in (:teamIds)) t "
            + "where t.rn <= :limit order by t.squad_id, t.rn", nativeQuery = true)
    java.util.List<Object[]> findNewestMembers(@Param("teamIds") Collection<UUID> teamIds, @Param("limit") int limit);

    /** Active teams of each membership as {@code [project_membership_id, squad_id]} rows, one query for a whole page. */
    @Query("select m.projectMembershipId, s.id from SquadMembership m, Squad s "
            + "where s.id = m.squadId and s.archivedAt is null and m.projectMembershipId in :membershipIds")
    java.util.List<Object[]> findActiveTeamsOf(Collection<UUID> membershipIds);

    @Query("select count(m) from SquadMembership m, Squad s "
            + "where s.id = m.squadId and s.archivedAt is null and m.projectMembershipId = :membershipId")
    long countActiveTeamsOf(UUID membershipId);

    /** Membership IDs that would belong to no active team once {@code teamId} is archived. */
    @Query("select m.projectMembershipId from SquadMembership m where m.squadId = :teamId and not exists ("
            + "select 1 from SquadMembership o, Squad s where o.projectMembershipId = m.projectMembershipId "
            + "and o.squadId <> :teamId and s.id = o.squadId and s.archivedAt is null)")
    java.util.List<UUID> findMembershipsOnlyIn(UUID teamId);

    @Query("select m.projectMembershipId from SquadMembership m "
            + "where m.squadId = :teamId and m.projectMembershipId in :membershipIds")
    java.util.List<UUID> findMembershipIdsInTeam(UUID teamId, Collection<UUID> membershipIds);
}
