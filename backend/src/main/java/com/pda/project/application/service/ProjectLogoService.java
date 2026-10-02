package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;
import com.pda.shared.ImageSniffer;
import com.pda.project.domain.entity.ProjectLogo;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.infrastructure.repository.ProjectLogoRepository;
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
 * Stores one logo per project in the database. The file name and the client-declared content type are never used:
 * the type is decided from the file's magic bytes, and only PNG, JPEG and WebP are accepted (no SVG, which can carry
 * script). Nothing is written to disk, so there is no path to traverse.
 */
@Service
public class ProjectLogoService {

    public record StoredLogo(String contentType, byte[] data) {
    }

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectLogoRepository logos;

    public ProjectLogoService(ProjectRepository projects, ProjectMembershipRepository memberships,
                              ProjectLogoRepository logos) {
        this.projects = projects;
        this.memberships = memberships;
        this.logos = logos;
    }

    @Transactional
    public void replace(UUID actorId, UUID projectId, byte[] data) {
        require(actorId, projectId, ProjectPermission.PROJECT_UPDATE);
        Project project = activeProject(projectId);
        if (data == null || data.length == 0) {
            throw new ProjectLogoException(ProjectLogoException.EMPTY);
        }
        if (data.length > ProjectLogo.MAX_BYTES) {
            throw new ProjectLogoException(ProjectLogoException.TOO_LARGE);
        }
        ImageSniffer.Image image;
        try {
            image = ImageSniffer.inspect(data);
        } catch (ImageSniffer.RejectedImageException rejected) {
            throw new ProjectLogoException(rejected.reason() == ImageSniffer.Reason.DIMENSIONS
                    ? ProjectLogoException.DIMENSIONS : ProjectLogoException.INVALID_TYPE);
        }
        String contentType = image.contentType();
        Instant now = Instant.now();
        ProjectLogo logo = logos.findById(projectId).orElse(null);
        if (logo == null) {
            logos.save(ProjectLogo.of(projectId, contentType, data, now));
        } else {
            logo.replace(contentType, data, now);
            logos.save(logo);
        }
        project.logoStored(actorId, now);
        projects.save(project);
    }

    @Transactional
    public void remove(UUID actorId, UUID projectId) {
        require(actorId, projectId, ProjectPermission.PROJECT_UPDATE);
        Project project = activeProject(projectId);
        logos.deleteById(projectId);
        project.logoRemoved(actorId);
        projects.save(project);
    }

    @Transactional(readOnly = true)
    public StoredLogo read(UUID actorId, UUID projectId) {
        require(actorId, projectId, ProjectPermission.PROJECT_VIEW);
        activeProject(projectId);
        ProjectLogo logo = logos.findById(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project logo not found"));
        return new StoredLogo(logo.getContentType(), logo.getData());
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
