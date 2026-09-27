package com.pda.project.repository;

import com.pda.BackendApplication;
import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectRepositoryConnection;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.infrastructure.repository.ProjectRepositoryConnectionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
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
class ProjectRepositoryConnectionRepositoryTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired private ProjectRepository projects;
    @Autowired private ProjectRepositoryConnectionRepository connections;

    @Test
    void onlyOneConnectionIsAllowedPerProject() {
        UUID projectId = newProject();
        connections.saveAndFlush(ProjectRepositoryConnection.connect(projectId, "owner", "repo",
                "https://github.com/owner/repo", "main", UUID.randomUUID()));

        assertThrows(DataIntegrityViolationException.class, () -> connections.saveAndFlush(
                ProjectRepositoryConnection.connect(projectId, "other", "repo2",
                        "https://github.com/other/repo2", "main", UUID.randomUUID())));
    }

    @Test
    void findAndDeleteByProjectIdWork() {
        UUID projectId = newProject();
        UUID connector = UUID.randomUUID();
        connections.saveAndFlush(ProjectRepositoryConnection.connect(projectId, "owner", "repo",
                "https://github.com/owner/repo", "main", connector));

        assertTrue(connections.findByProjectId(projectId).isPresent());
        assertEquals(connector, connections.findByProjectId(projectId).orElseThrow().getConnectedBy());
        assertTrue(connections.findByProjectId(UUID.randomUUID()).isEmpty());

        connections.deleteByProjectId(projectId);
        connections.flush();
        assertFalse(connections.findByProjectId(projectId).isPresent());
    }

    private UUID newProject() {
        return projects.saveAndFlush(Project.create("Repo host " + UUID.randomUUID(),
                "repo-host-" + UUID.randomUUID(), null, UUID.randomUUID())).getId();
    }
}
