package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectBanner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProjectBannerRepository extends JpaRepository<ProjectBanner, UUID> {
}
