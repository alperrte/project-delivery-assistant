package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.domain.enums.ProjectRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ProjectMembershipRepository extends JpaRepository<ProjectMembership, UUID> {

    Optional<ProjectMembership> findByProjectIdAndUserId(UUID projectId, UUID userId);

    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);

    Optional<ProjectMembership> findByProjectIdAndUserIdAndStatus(UUID projectId, UUID userId,
                                                                  MembershipStatus status);

    Page<ProjectMembership> findByProjectIdAndStatus(UUID projectId, MembershipStatus status,
                                                     Pageable pageable);

    @Query("select count(m) from ProjectMembership m join m.roles role where m.projectId = :projectId "
            + "and m.status = :status and role = :role")
    long countWithRole(@Param("projectId") UUID projectId, @Param("status") MembershipStatus status,
                       @Param("role") ProjectRole role);
}
