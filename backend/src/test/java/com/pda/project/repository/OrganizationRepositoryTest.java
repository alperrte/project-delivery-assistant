package com.pda.project.repository;

import com.pda.BackendApplication;
import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.infrastructure.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = BackendApplication.class)
@Testcontainers
class OrganizationRepositoryTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

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
