package com.pda.project.organization.application;

import com.pda.project.application.service.SlugGenerator;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.infrastructure.OrganizationMediaRepository;
import com.pda.project.organization.infrastructure.OrganizationRepository;
import com.pda.shared.MediaStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;
import java.util.Optional;

@Service
public class OrganizationService {

    private static final Logger log = LoggerFactory.getLogger(OrganizationService.class);

    private final OrganizationRepository organizations;
    private final ProjectRepository projects;
    private final OrganizationMediaRepository mediaObjects;
    private final MediaStorage storage;

    public OrganizationService(OrganizationRepository organizations, ProjectRepository projects,
                               OrganizationMediaRepository mediaObjects, MediaStorage storage) {
        this.organizations = organizations;
        this.projects = projects;
        this.mediaObjects = mediaObjects;
        this.storage = storage;
    }

    @Transactional
    public Organization create(UUID actorId, String name, String description) {
        return create(actorId, name, description, null, null, null);
    }

    @Transactional
    public Organization create(UUID actorId, String name, String description, String website, String contactEmail, String location) {
        return create(actorId, name, description, website, contactEmail, location, null);
    }

    @Transactional
    public Organization create(UUID actorId, String name, String description, String website, String contactEmail, String location, String notes) {
        Objects.requireNonNull(actorId, "actorId is required");
        Organization organization = Organization.create(name, SlugGenerator.generate(name),
                description, actorId);
        organization.updateProfile(name, description, website, contactEmail, location, notes);
        return organizations.saveAndFlush(organization);
    }

    @Transactional(readOnly = true)
    public Organization detail(UUID actorId, UUID organizationId) {
        return ownedOrganization(actorId, organizationId);
    }

    @Transactional(readOnly = true)
    public Page<Organization> listOwned(UUID actorId, Pageable pageable) {
        Objects.requireNonNull(actorId, "actorId is required");
        return organizations.findByOwnerUserIdAndArchivedAtIsNull(actorId, pageable);
    }

    @Transactional
    public Organization update(UUID actorId, UUID organizationId, String name, String description) {
        return update(actorId, organizationId, name, description, null, null, null);
    }

    @Transactional
    public Organization update(UUID actorId, UUID organizationId, String name, String description, String website, String contactEmail, String location) {
        return update(actorId, organizationId, name, description, website, contactEmail, location, null);
    }

    @Transactional
    public Organization update(UUID actorId, UUID organizationId, String name, String description, String website, String contactEmail, String location, String notes) {
        Organization organization = lockedOwned(actorId, organizationId);
        organization.updateProfile(name, description, website, contactEmail, location, notes);
        return organizations.save(organization);
    }

    /**
     * Permanent and irreversible. The projects keep living: they are only unlinked from the organization (they may
     * belong to other people), and the organization's logo/cover rows and files are removed with it.
     */
    @Transactional
    public void delete(UUID actorId, UUID organizationId) {
        Organization organization = lockedOwned(actorId, organizationId);
        projects.detachFromOrganization(organizationId);
        List<String> mediaKeys = mediaObjects.keysOf(organizationId);
        mediaObjects.deleteAllOf(organizationId);
        organizations.delete(organization);
        organizations.flush();
        removeFilesAfterCommit(mediaKeys);
    }

    /** The files go only once the database rows are really gone; a failed delete leaves an orphan file, never a dangling row. */
    private void removeFilesAfterCommit(List<String> keys) {
        if (keys.isEmpty()) return;
        Runnable remove = () -> keys.forEach(key -> {
            try {
                storage.delete(key);
            } catch (IOException | RuntimeException failed) {
                log.warn("Organization media file {} could not be deleted", key, failed);
            }
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { remove.run(); }
            });
        } else {
            remove.run();
        }
    }

    @Transactional(readOnly = true)
    public Optional<Organization> findActive(UUID organizationId) {
        return organizations.findByIdAndArchivedAtIsNull(organizationId);
    }

    @Transactional(readOnly = true)
    public Organization requireActive(UUID organizationId) {
        return organizations.findByIdAndArchivedAtIsNull(organizationId)
                .orElseThrow(() -> new NoSuchElementException("Organization not found"));
    }

    public Organization lockedOwned(UUID actorId, UUID organizationId) {
        Objects.requireNonNull(actorId, "actorId is required");
        Organization organization = organizations.lockActive(organizationId)
                .orElseThrow(() -> new NoSuchElementException("Organization not found"));
        if (!organization.getOwnerUserId().equals(actorId)) throw new AccessDeniedException("Organization access denied");
        return organization;
    }

    private Organization ownedOrganization(UUID actorId, UUID organizationId) {
        Objects.requireNonNull(actorId, "actorId is required");
        Objects.requireNonNull(organizationId, "organizationId is required");
        Organization organization = requireActive(organizationId);
        if (!organization.getOwnerUserId().equals(actorId)) {
            throw new AccessDeniedException("Organization access denied");
        }
        return organization;
    }
}
