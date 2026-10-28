package com.pda.project.repository;

import com.pda.shared.testing.RepositoryTestBase;

import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectRepositoryConnection;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.infrastructure.repository.ProjectRepositoryConnectionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjectRepositoryConnectionRepositoryTest extends RepositoryTestBase {


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
