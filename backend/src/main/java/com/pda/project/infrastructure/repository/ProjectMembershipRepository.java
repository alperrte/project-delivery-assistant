package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.user.ProjectRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectMembershipRepository extends JpaRepository<ProjectMembership, UUID> {

    Optional<ProjectMembership> findByProjectIdAndUserId(UUID projectId, UUID userId);

    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);

    Optional<ProjectMembership> findByProjectIdAndUserIdAndStatus(UUID projectId, UUID userId,
                                                                  MembershipStatus status);

    @Query("select m.userId from ProjectMembership m where m.projectId = :projectId "
            + "and m.status = com.pda.project.domain.enums.MembershipStatus.ACTIVE and m.userId in :userIds")
    List<UUID> findActiveUserIds(@Param("projectId") UUID projectId, @Param("userIds") Collection<UUID> userIds);

    Page<ProjectMembership> findByProjectIdAndStatus(UUID projectId, MembershipStatus status,
                                                     Pageable pageable);

    List<ProjectMembership> findByProjectIdAndIdInAndStatus(UUID projectId, Collection<UUID> ids,
                                                            MembershipStatus status);

    @Query("select m.projectId, count(m) from ProjectMembership m where m.projectId in :projectIds "
            + "and m.status = com.pda.project.domain.enums.MembershipStatus.ACTIVE group by m.projectId")
    List<Object[]> countActiveByProjectIds(@Param("projectIds") Collection<UUID> projectIds);

    @Query("select count(m) from ProjectMembership m join m.roles role where m.projectId = :projectId "
            + "and m.status = :status and role = :role")
    long countWithRole(@Param("projectId") UUID projectId, @Param("status") MembershipStatus status,
                       @Param("role") ProjectRole role);

    long countByProjectIdAndStatus(UUID projectId, MembershipStatus status);

    @Query("select m from ProjectMembership m join m.roles role where m.projectId = :projectId "
            + "and m.status = :status and role = :role")
    List<ProjectMembership> findByProjectIdAndStatusAndRole(@Param("projectId") UUID projectId,
                                                            @Param("status") MembershipStatus status,
                                                            @Param("role") ProjectRole role);
}
