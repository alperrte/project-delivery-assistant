package com.pda.project.application;

import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.domain.OrganizationStatus;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class OrganizationDomainTest {

    @Test
    void organizationHasOwnerAndCanonicalSlug() {
        UUID ownerId = UUID.randomUUID();
        Organization organization = Organization.create("  PDA Team ", "PDA-Team", null, ownerId);

        assertEquals("PDA Team", organization.getName());
        assertEquals("pda-team", organization.getSlug());
        assertEquals(ownerId, organization.getOwnerUserId());
        assertEquals(OrganizationStatus.ACTIVE, organization.getStatus());
    }

    @Test
    void invalidIdentityIsRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> Organization.create(" ", "valid", null, UUID.randomUUID()));
        assertThrows(IllegalArgumentException.class,
                () -> Organization.create("Valid", "bad--slug", null, UUID.randomUUID()));
        assertThrows(NullPointerException.class,
                () -> Organization.create("Valid", "valid", null, null));
    }

    @Test
    void archivePreventsMetadataChanges() {
        Organization organization = Organization.create("PDA", "pda", null, UUID.randomUUID());
        organization.archive();

        assertEquals(OrganizationStatus.ARCHIVED, organization.getStatus());
        assertNotNull(organization.getArchivedAt());
        assertThrows(IllegalStateException.class, () -> organization.updateDetails("Changed", null));
    }
}
