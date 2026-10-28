package com.pda.project.repository;

import com.pda.shared.testing.RepositoryTestBase;

import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.infrastructure.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrganizationRepositoryTest extends RepositoryTestBase {


    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    @Autowired
    private OrganizationRepository organizations;

    @Test
    void slugIsUnique() {
        organizations.saveAndFlush(Organization.create("First", "same-slug", null, UUID.randomUUID()));

        assertThrows(DataIntegrityViolationException.class, () ->
                organizations.saveAndFlush(Organization.create("Second", "same-slug", null, UUID.randomUUID())));
    }

    @Test
    void archiveFiltersNormalQueries() {
        UUID ownerId = UUID.randomUUID();
        Organization active = organizations.saveAndFlush(Organization.create("Active", "active", null, ownerId));
        Organization archived = organizations.saveAndFlush(Organization.create("Archived", "archived", null, ownerId));
        archived.archive();
        organizations.saveAndFlush(archived);

        assertEquals(1, organizations.findByArchivedAtIsNull(PageRequest.of(0, 10)).getTotalElements());
        assertEquals(1, organizations.findByOwnerUserIdAndArchivedAtIsNull(ownerId, PageRequest.of(0, 10)).getTotalElements());
        assertTrue(organizations.findByIdAndArchivedAtIsNull(active.getId()).isPresent());
        assertFalse(organizations.findBySlugAndArchivedAtIsNull("archived").isPresent());
    }
    @Test
    void expandedProfileRoundTripsWithNullableLegacyFields() {
        Organization old = organizations.saveAndFlush(Organization.create("Legacy", "legacy", null, UUID.randomUUID()));
        assertEquals(null, old.getWebsite());
        old.updateProfile("Legacy", "Description", "https://example.com", "info@example.com", "Istanbul", "Persistent notes");
        organizations.saveAndFlush(old);
        UUID savedId = old.getId();
        entityManager.clear();
        Organization loaded = organizations.findById(savedId).orElseThrow();
        assertEquals("https://example.com", loaded.getWebsite());
        assertEquals("info@example.com", loaded.getContactEmail());
        assertEquals("Persistent notes", loaded.getNotes());
    }

}
