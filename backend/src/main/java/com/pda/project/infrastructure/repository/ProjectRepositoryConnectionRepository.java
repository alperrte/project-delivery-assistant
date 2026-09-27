package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectRepositoryConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ProjectRepositoryConnectionRepository extends JpaRepository<ProjectRepositoryConnection, UUID> {

    Optional<ProjectRepositoryConnection> findByProjectId(UUID projectId);

    void deleteByProjectId(UUID projectId);
}
