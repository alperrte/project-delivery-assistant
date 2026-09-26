package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectMembership;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ProjectMembershipRepository extends JpaRepository<ProjectMembership, UUID> {

    Optional<ProjectMembership> findByProjectIdAndUserId(UUID projectId, UUID userId);

    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);
}
