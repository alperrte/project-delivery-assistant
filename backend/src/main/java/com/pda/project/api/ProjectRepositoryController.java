package com.pda.project.api;

import com.pda.project.api.dto.request.ConnectRepositoryRequest;
import com.pda.project.api.dto.request.UpdateRepositorySettingsRequest;
import com.pda.project.api.dto.response.CommitResponse;
import com.pda.project.api.dto.response.RepositoryBranchesResponse;
import com.pda.project.api.dto.response.RepositoryCompareResponse;
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
import org.springframework.web.bind.annotation.PatchMapping;
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
                repository.connect(AuthenticatedActor.id(principal), projectId, request.repositoryUrl(),
                        request.trackingMode(), request.notifyOnCommits()));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PatchMapping
    @Operation(summary = "Change the repository tracking mode and the commit notification switch",
            description = "PROJECT_MANAGER only. trackingMode BASIC|ADVANCED and notifyOnCommits are both "
                    + "required; 404 when no repository is connected. Requires CSRF.")
    public RepositoryConnectionResponse updateSettings(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal, @PathVariable UUID projectId,
            @Valid @RequestBody UpdateRepositorySettingsRequest request) {
        return RepositoryConnectionResponse.from(repository.updateSettings(AuthenticatedActor.id(principal),
                projectId, request.trackingMode(), request.notifyOnCommits()));
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
    @Operation(summary = "List commits of a branch of the connected repository (default branch when omitted)",
            description = "Project members only. Read-only. branch must be an existing branch, author a GitHub "
                    + "login, page 1..10, limit 1..50 (default 10). A GitHub failure never fails the whole request "
                    + "beyond this endpoint; 429 when the per-user read limit or GitHub's limit is reached.")
    public List<CommitResponse> commits(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId,
                                       @RequestParam(required = false) String branch,
                                       @RequestParam(required = false) String author,
                                       @RequestParam(required = false) Integer page,
                                       @RequestParam(required = false) Integer limit) {
        return repository.commits(AuthenticatedActor.id(principal), projectId, branch, author, page, limit).stream()
                .map(CommitResponse::from).toList();
    }

    @GetMapping("/branches")
    @Operation(summary = "List the connected repository's branches (default branch first)",
            description = "Project members only. Read-only; at most 100 branches, truncated=true when there are more.")
    public RepositoryBranchesResponse branches(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                               @PathVariable UUID projectId) {
        return RepositoryBranchesResponse.from(repository.branches(AuthenticatedActor.id(principal), projectId));
    }

    @GetMapping("/compare")
    @Operation(summary = "Commits of a branch that are not on the default branch yet",
            description = "Project members only. Read-only; empty for the default branch itself, at most 100 "
                    + "commits (truncated=true when there are more).")
    public RepositoryCompareResponse compare(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                             @PathVariable UUID projectId,
                                             @RequestParam(required = false) String branch) {
        return RepositoryCompareResponse.from(repository.compare(AuthenticatedActor.id(principal), projectId, branch));
    }
}
