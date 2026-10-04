package com.pda.project.organization.api;

import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.domain.OrganizationStatus;

import java.time.Instant;
import java.util.UUID;

public record OrganizationResponse(
        UUID id,
        String name,
        String slug,
        String description,
        String website,
        String contactEmail,
        String location,
        String notes,
        String logoVersion,
        String coverVersion,
        UUID ownerUserId,
        OrganizationStatus status,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
) {
    public static OrganizationResponse from(Organization organization) {
        return new OrganizationResponse(organization.getId(), organization.getName(),
                organization.getSlug(), organization.getDescription(), organization.getWebsite(),
                organization.getContactEmail(), organization.getLocation(), organization.getNotes(), organization.getLogoKey(),
                organization.getCoverKey(), organization.getOwnerUserId(),
                organization.getStatus(), organization.getCreatedAt(), organization.getUpdatedAt(),
                organization.getArchivedAt());
    }
}
