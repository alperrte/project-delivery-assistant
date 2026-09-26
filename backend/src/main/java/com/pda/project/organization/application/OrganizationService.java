package com.pda.project.organization.application;

import com.pda.project.application.service.SlugGenerator;
import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.infrastructure.OrganizationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

@Service
public class OrganizationService {

    private final OrganizationRepository organizations;

    public OrganizationService(OrganizationRepository organizations) {
        this.organizations = organizations;
    }

    @Transactional
    public Organization create(UUID actorId, String name, String description) {
        Objects.requireNonNull(actorId, "actorId is required");
        Organization organization = Organization.create(name, SlugGenerator.generate(name),
                description, actorId);
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
        Organization organization = ownedOrganization(actorId, organizationId);
        organization.updateDetails(name, description);
        return organizations.save(organization);
    }

    @Transactional
    public void archive(UUID actorId, UUID organizationId) {
        Organization organization = ownedOrganization(actorId, organizationId);
        organization.archive();
        organizations.save(organization);
    }

    @Transactional(readOnly = true)
    public Organization requireActive(UUID organizationId) {
        return organizations.findByIdAndArchivedAtIsNull(organizationId)
                .orElseThrow(() -> new NoSuchElementException("Organization not found"));
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
