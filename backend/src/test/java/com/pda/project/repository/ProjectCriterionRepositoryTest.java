package com.pda.project.repository;

import com.pda.BackendApplication;
import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectCriterion;
import com.pda.project.infrastructure.repository.ProjectCriterionRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = BackendApplication.class)
@Testcontainers
class ProjectCriterionRepositoryTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired private ProjectRepository projects;
    @Autowired private ProjectCriterionRepository criteria;
    @Autowired private EntityManager entityManager;

    @Test
    void criteriaAreOrderedBySortOrderAndCountsWork() {
        UUID projectId = newProject();
        UUID creator = UUID.randomUUID();
        ProjectCriterion second = criteria.saveAndFlush(
                ProjectCriterion.create(projectId, "Second", null, 1, creator));
        ProjectCriterion first = criteria.saveAndFlush(
                ProjectCriterion.create(projectId, "First", null, 0, creator));
        first.complete(creator);
        criteria.saveAndFlush(first);

        List<ProjectCriterion> ordered = criteria.findByProjectIdOrderBySortOrderAsc(projectId);
        assertEquals(2, ordered.size());
        assertEquals("First", ordered.get(0).getTitle());
        assertEquals("Second", ordered.get(1).getTitle());
        assertEquals(2, criteria.countByProjectId(projectId));
        assertEquals(1, criteria.countByProjectIdAndCompletedTrue(projectId));
        assertEquals(1, criteria.findMaxSortOrder(projectId));
        assertEquals(-1, criteria.findMaxSortOrder(UUID.randomUUID()));
        assertTrue(criteria.findByIdAndProjectId(second.getId(), projectId).isPresent());
        assertTrue(criteria.findByIdAndProjectId(second.getId(), UUID.randomUUID()).isEmpty());
    }

    @Test
    void criterionRoundTripsThroughPostgres() {
        UUID projectId = newProject();
        UUID creator = UUID.randomUUID();
        UUID id = criteria.saveAndFlush(
                ProjectCriterion.create(projectId, "Ship V1", "Everything green", 0, creator)).getId();
        entityManager.clear();

        ProjectCriterion stored = criteria.findById(id).orElseThrow();
        assertEquals("Ship V1", stored.getTitle());
        assertEquals("Everything green", stored.getDescription());
        assertEquals(creator, stored.getCreatedBy());
        assertTrue(stored.getCreatedAt() != null);
    }

    @Test
    void completionConsistencyIsEnforcedAtTheDatabaseLevel() {
        UUID projectId = newProject();
        assertThrows(Exception.class, () -> entityManager.createNativeQuery(
                "INSERT INTO project_criteria (id, project_id, title, completed, sort_order, created_by, "
                        + "created_at, completed_by, completed_at) VALUES (?,?,?,TRUE,0,?,now(),NULL,NULL)")
                .setParameter(1, UUID.randomUUID()).setParameter(2, projectId).setParameter(3, "Bad row")
                .setParameter(4, UUID.randomUUID())
                .executeUpdate());
    }

    private UUID newProject() {
        return projects.saveAndFlush(Project.create("Criteria host " + UUID.randomUUID(),
                "criteria-host-" + UUID.randomUUID(), null, UUID.randomUUID())).getId();
    }
}
