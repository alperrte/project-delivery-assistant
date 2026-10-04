package com.pda.project.application;

import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.domain.OrganizationStatus;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
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
    @Test
    void expandedProfileValidatesAndNormalizes() {
        Organization org = Organization.create("PDA", "pda", null, UUID.randomUUID());
        org.updateProfile("PDA", null, " https://example.com ", "info@example.com", " Istanbul ");
        assertEquals("https://example.com", org.getWebsite());
        assertEquals("Istanbul", org.getLocation());
        assertThrows(IllegalArgumentException.class, () -> org.updateProfile("PDA", null, "javascript:alert(1)", null, null));
        assertThrows(IllegalArgumentException.class, () -> org.updateProfile("PDA", null, "https://user:pass@example.com", null, null));
        assertThrows(IllegalArgumentException.class, () -> org.updateProfile("PDA", null, null, "bad", null));
        assertThrows(IllegalArgumentException.class, () -> org.updateProfile("PDA", null, null, null, "x".repeat(201)));
        org.updateProfile("PDA", null, " ", "", null);
        org.mediaStored("LOGO", UUID.randomUUID().toString());
        assertNotNull(org.getLogoKey());
        org.mediaStored("LOGO", null);
        org.archive();
        assertThrows(IllegalStateException.class, () -> org.mediaStored("COVER", "key"));
    }

    @Test
    void notesAreOptionalIndependentAndBounded() {
        Organization org = Organization.create("PDA", "pda", "Short description", UUID.randomUUID());
        org.updateProfile("PDA", "Short description", null, null, null, "  Extra information  ");
        assertEquals("Extra information", org.getNotes());
        assertEquals("Short description", org.getDescription());
        assertThrows(IllegalArgumentException.class, () -> org.updateProfile("PDA", "Changed", null, null, null, "x".repeat(1001)));
        assertEquals("Short description", org.getDescription());
        org.updateProfile("PDA", "Short description", null, null, null, " ");
        assertNull(org.getNotes());
    }

}
