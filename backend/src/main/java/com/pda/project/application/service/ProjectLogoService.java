package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;
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
        String contentType = detectType(data);
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

    static String detectType(byte[] data) {
        if (data.length >= 8 && (data[0] & 0xFF) == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G'
                && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A) {
            return "image/png";
        }
        if (data.length >= 3 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (data.length >= 12 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F'
                && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P') {
            return "image/webp";
        }
        throw new ProjectLogoException(ProjectLogoException.INVALID_TYPE);
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
