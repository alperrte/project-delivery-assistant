package com.pda.project.application;

import com.pda.project.domain.entity.ProjectRepositoryConnection;
import com.pda.project.domain.enums.RepositoryProvider;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProjectRepositoryConnectionDomainTest {

    private final UUID projectId = UUID.randomUUID();
    private final UUID connectorId = UUID.randomUUID();

    @Test
    void connectStoresParsedRepositoryDetails() {
        ProjectRepositoryConnection connection = ProjectRepositoryConnection.connect(projectId, "alperrte",
                "project-delivery-assistant", "https://github.com/alperrte/project-delivery-assistant", "main",
                connectorId);

        assertEquals(RepositoryProvider.GITHUB, connection.getProvider());
        assertEquals("alperrte", connection.getRepositoryOwner());
        assertEquals("project-delivery-assistant", connection.getRepositoryName());
        assertEquals("https://github.com/alperrte/project-delivery-assistant", connection.getRepositoryUrl());
        assertEquals("main", connection.getDefaultBranch());
        assertEquals(connectorId, connection.getConnectedBy());
    }

    @Test
    void requiredFieldsAreEnforced() {
        assertThrows(NullPointerException.class,
                () -> ProjectRepositoryConnection.connect(null, "o", "r", "https://github.com/o/r", "main",
                        connectorId));
        assertThrows(IllegalArgumentException.class,
                () -> ProjectRepositoryConnection.connect(projectId, " ", "r", "https://github.com/o/r", "main",
                        connectorId));
        assertThrows(NullPointerException.class,
                () -> ProjectRepositoryConnection.connect(projectId, "o", "r", "https://github.com/o/r", "main",
                        null));
    }

    @Test
    void updateReplacesTargetButKeepsConnectionAudit() {
        ProjectRepositoryConnection connection = ProjectRepositoryConnection.connect(projectId, "old-owner",
                "old-repo", "https://github.com/old-owner/old-repo", "main", connectorId);

        connection.update("new-owner", "new-repo", "https://github.com/new-owner/new-repo", "develop");

        assertEquals("new-owner", connection.getRepositoryOwner());
        assertEquals("new-repo", connection.getRepositoryName());
        assertEquals("develop", connection.getDefaultBranch());
        assertEquals(connectorId, connection.getConnectedBy());
    }
}
