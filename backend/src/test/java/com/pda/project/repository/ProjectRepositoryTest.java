package com.pda.project.repository;

import com.pda.BackendApplication;
import com.pda.project.domain.entity.Project;
import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.infrastructure.OrganizationRepository;
import jakarta.persistence.EntityManager;
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

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = BackendApplication.class)
@Testcontainers
class ProjectRepositoryTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private ProjectRepository projects;

    @Autowired
    private OrganizationRepository organizations;

    @Autowired
    private EntityManager entityManager;

    @Test
    void slugIsUniqueInTheDatabase() {
        projects.saveAndFlush(Project.create("First", "same-slug", null, UUID.randomUUID()));

        assertThrows(DataIntegrityViolationException.class, () ->
                projects.saveAndFlush(Project.create("Second", "same-slug", null, UUID.randomUUID())));
    }

    @Test
    void activeQueriesExcludeArchivedProjects() {
        Project active = projects.saveAndFlush(Project.create("Active", "active", null, UUID.randomUUID()));
        Project archived = projects.saveAndFlush(Project.create("Archived", "archived", null, UUID.randomUUID()));
        archived.archive();
        projects.saveAndFlush(archived);

        assertEquals(1, projects.findByArchivedAtIsNull(PageRequest.of(0, 10)).getTotalElements());
        assertTrue(projects.findBySlugAndArchivedAtIsNull("active").isPresent());
        assertFalse(projects.findBySlugAndArchivedAtIsNull("archived").isPresent());
        assertTrue(projects.findByIdAndArchivedAtIsNull(active.getId()).isPresent());
        assertFalse(projects.findByIdAndArchivedAtIsNull(archived.getId()).isPresent());
    }

    @Test
    void projectMetadataRoundTripsThroughPostgres() {
        UUID organizationId = organizations.saveAndFlush(
                Organization.create("PDA Team", "pda-team", null, UUID.randomUUID())).getId();
        Project project = Project.create("PDA", "pda", "Planning tool", UUID.randomUUID());
        project.updateDetails("PDA", "Planning tool", ProjectPriority.HIGH,
                LocalDate.of(2026, 9, 27), LocalDate.of(2026, 12, 1),
                "Release V1", "Java, TypeScript", organizationId);
        UUID id = projects.saveAndFlush(project).getId();
        entityManager.clear();

        Project stored = projects.findById(id).orElseThrow();
        assertEquals(organizationId, stored.getOrganizationId());
        assertEquals(ProjectPriority.HIGH, stored.getPriority());
        assertEquals(LocalDate.of(2026, 12, 1), stored.getTargetEndDate());
        assertEquals("Release V1", stored.getProjectGoal());
        assertEquals("Java, TypeScript", stored.getTechStack());
        assertTrue(stored.getCreatedAt() != null && stored.getUpdatedAt() != null);
    }

    @Test
    void organizationProjectQueryExcludesArchivedAndStandaloneProjects() {
        UUID organizationId = organizations.saveAndFlush(
                Organization.create("Team", "team", null, UUID.randomUUID())).getId();
        Project active = Project.create("Linked", "linked", null, UUID.randomUUID());
        active.updateDetails("Linked", null, ProjectPriority.MEDIUM,
                null, null, null, null, organizationId);
        projects.saveAndFlush(active);
        Project archived = Project.create("Old", "old", null, UUID.randomUUID());
        archived.updateDetails("Old", null, ProjectPriority.MEDIUM,
                null, null, null, null, organizationId);
        archived.archive();
        projects.saveAndFlush(archived);
        projects.saveAndFlush(Project.create("Standalone", "standalone", null, UUID.randomUUID()));

        assertEquals(1, projects.findByOrganizationIdAndArchivedAtIsNull(
                organizationId, PageRequest.of(0, 10)).getTotalElements());
    }

}
