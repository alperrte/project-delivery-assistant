package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;
import com.pda.shared.ImageSniffer;
import com.pda.project.domain.entity.ProjectBanner;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.infrastructure.repository.ProjectBannerRepository;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.RolePolicy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

/**
 * Stores one banner (cover image) per project in the database, the same way {@link ProjectLogoService} stores the
 * logo: the type comes from the file's magic bytes only, nothing is written to disk, and a larger size limit applies.
 */
@Service
public class ProjectBannerService {

    public record StoredBanner(String contentType, byte[] data) {
    }

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectBannerRepository banners;

    public ProjectBannerService(ProjectRepository projects, ProjectMembershipRepository memberships,
                                ProjectBannerRepository banners) {
        this.projects = projects;
        this.memberships = memberships;
        this.banners = banners;
    }

    @Transactional
    public void replace(UUID actorId, UUID projectId, byte[] data) {
        require(actorId, projectId, ProjectPermission.PROJECT_UPDATE);
        Project project = activeProject(projectId);
        if (data == null || data.length == 0) {
            throw new ProjectBannerException(ProjectBannerException.EMPTY);
        }
        if (data.length > ProjectBanner.MAX_BYTES) {
            throw new ProjectBannerException(ProjectBannerException.TOO_LARGE);
        }
        ImageSniffer.Image image;
        try {
            image = ImageSniffer.inspect(data);
        } catch (ImageSniffer.RejectedImageException rejected) {
            throw new ProjectBannerException(rejected.reason() == ImageSniffer.Reason.DIMENSIONS
                    ? ProjectBannerException.DIMENSIONS : ProjectBannerException.INVALID_TYPE);
        }
        String contentType = image.contentType();
        Instant now = Instant.now();
        ProjectBanner banner = banners.findById(projectId).orElse(null);
        if (banner == null) {
            banners.save(ProjectBanner.of(projectId, contentType, data, now));
        } else {
            banner.replace(contentType, data, now);
            banners.save(banner);
        }
        project.bannerStored(actorId, now);
        projects.save(project);
    }

    @Transactional
    public void remove(UUID actorId, UUID projectId) {
        require(actorId, projectId, ProjectPermission.PROJECT_UPDATE);
        Project project = activeProject(projectId);
        banners.deleteById(projectId);
        project.bannerRemoved(actorId);
        projects.save(project);
    }

    @Transactional(readOnly = true)
    public StoredBanner read(UUID actorId, UUID projectId) {
        require(actorId, projectId, ProjectPermission.PROJECT_VIEW);
        activeProject(projectId);
        ProjectBanner banner = banners.findById(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project banner not found"));
        return new StoredBanner(banner.getContentType(), banner.getData());
    }

    private Project activeProject(UUID projectId) {
        return projects.findByIdAndArchivedAtIsNull(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
    }

    private void require(UUID actorId, UUID projectId, ProjectPermission permission) {
        Objects.requireNonNull(actorId, "actorId is required");
        Objects.requireNonNull(projectId, "projectId is required");
        ProjectMembership membership = memberships
                .findByProjectIdAndUserIdAndStatus(projectId, actorId, MembershipStatus.ACTIVE)
                .orElseThrow(() -> new AccessDeniedException("Project access denied"));
        if (!RolePolicy.allows(membership.getRoles(), permission)) {
            throw new AccessDeniedException("Project permission denied");
        }
    }
}
