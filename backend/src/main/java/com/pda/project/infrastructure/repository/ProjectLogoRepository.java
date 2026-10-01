package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectLogo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProjectLogoRepository extends JpaRepository<ProjectLogo, UUID> {
}
