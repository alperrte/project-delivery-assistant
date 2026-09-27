package com.pda.project.api;

import com.pda.project.api.dto.request.ConnectRepositoryRequest;
import com.pda.project.api.dto.response.CommitResponse;
import com.pda.project.api.dto.response.RepositoryConnectionResponse;
import com.pda.project.application.service.ProjectRepositoryConnectionService;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/repository")
public class ProjectRepositoryController {

    private final ProjectRepositoryConnectionService repository;

    public ProjectRepositoryController(ProjectRepositoryConnectionService repository) {
        this.repository = repository;
    }

    @GetMapping
    @Operation(summary = "Get the connected public GitHub repository", description = "Project members only.")
    public RepositoryConnectionResponse detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @PathVariable UUID projectId) {
        return RepositoryConnectionResponse.from(repository.detail(AuthenticatedActor.id(principal), projectId));
    }

    @PostMapping
    @Operation(summary = "Connect (or replace) the project's public GitHub repository",
            description = "PROJECT_MANAGER only. Public github.com repositories only; the URL is parsed, never "
                    + "fetched as-is. Requires CSRF.")
    public ResponseEntity<RepositoryConnectionResponse> connect(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal, @PathVariable UUID projectId,
            @Valid @RequestBody ConnectRepositoryRequest request) {
        RepositoryConnectionResponse body = RepositoryConnectionResponse.from(
                repository.connect(AuthenticatedActor.id(principal), projectId, request.repositoryUrl()));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @DeleteMapping
    @Operation(summary = "Disconnect the project's repository", description = "PROJECT_MANAGER only. Project data "
            + "itself is never deleted. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Repository disconnected")
    public ResponseEntity<Void> disconnect(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                          @PathVariable UUID projectId) {
        repository.disconnect(AuthenticatedActor.id(principal), projectId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/commits")
    @Operation(summary = "List the latest commits on the connected repository's default branch",
            description = "Project members only. Read-only; a GitHub failure never fails the whole request beyond "
                    + "this endpoint.")
    public List<CommitResponse> commits(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId,
                                       @RequestParam(required = false) Integer limit) {
        return repository.latestCommits(AuthenticatedActor.id(principal), projectId, limit).stream()
                .map(CommitResponse::from).toList();
    }
}
