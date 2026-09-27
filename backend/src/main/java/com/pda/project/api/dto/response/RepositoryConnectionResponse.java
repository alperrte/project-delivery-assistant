package com.pda.project.api.dto.response;

import com.pda.project.domain.entity.ProjectRepositoryConnection;
import com.pda.project.domain.enums.RepositoryProvider;

import java.time.Instant;
import java.util.UUID;

public record RepositoryConnectionResponse(RepositoryProvider provider, String repositoryUrl,
                                           String repositoryOwner, String repositoryName, String defaultBranch,
                                           UUID connectedBy, Instant connectedAt, Instant updatedAt) {
    public static RepositoryConnectionResponse from(ProjectRepositoryConnection connection) {
        return new RepositoryConnectionResponse(connection.getProvider(), connection.getRepositoryUrl(),
                connection.getRepositoryOwner(), connection.getRepositoryName(), connection.getDefaultBranch(),
                connection.getConnectedBy(), connection.getConnectedAt(), connection.getUpdatedAt());
    }
}
