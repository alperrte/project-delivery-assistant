package com.pda.project.api;

import com.pda.project.api.dto.request.CreateProjectRequest;
import com.pda.project.api.dto.request.UpdateProjectRequest;
import com.pda.project.api.dto.response.PageResponse;
import com.pda.project.api.dto.response.ProjectResponse;
import com.pda.project.application.service.ProjectService;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService projects;

    public ProjectController(ProjectService projects) {
        this.projects = projects;
    }

    @PostMapping
    @Operation(summary = "Create a project", description = "Authenticated creator becomes its first PROJECT_MANAGER. Requires CSRF.")
    @ApiResponse(responseCode = "201", description = "Project and first manager membership created")
    public ResponseEntity<ProjectResponse> create(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody CreateProjectRequest request) {
        ProjectResponse response = ProjectResponse.from(projects.create(AuthenticatedActor.id(principal),
                request.name(), request.description(), request.organizationId()));
        return ResponseEntity.created(URI.create("/api/v1/projects/" + response.id())).body(response);
    }

    @GetMapping
    @Operation(summary = "List own projects", description = "Only active projects with a membership are returned.")
    public PageResponse<ProjectResponse> list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(projects.list(AuthenticatedActor.id(principal), pageRequest(page, size)),
                ProjectResponse::from);
    }

    @GetMapping("/{projectId}")
    @Operation(summary = "Get a project", description = "Requires membership in this project.")
    public ProjectResponse detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                  @PathVariable UUID projectId) {
        return ProjectResponse.from(projects.detail(AuthenticatedActor.id(principal), projectId));
    }

    @GetMapping("/by-slug/{slug}")
    @Operation(summary = "Get a project by slug", description = "Requires membership in this project.")
    public ProjectResponse bySlug(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                  @PathVariable String slug) {
        return ProjectResponse.from(projects.detailBySlug(AuthenticatedActor.id(principal), slug));
    }

    @PutMapping("/{projectId}")
    @Operation(summary = "Update project details", description = "PROJECT_MANAGER only. Requires CSRF.")
    public ProjectResponse update(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                  @PathVariable UUID projectId,
                                  @Valid @RequestBody UpdateProjectRequest request) {
        return ProjectResponse.from(projects.update(AuthenticatedActor.id(principal), projectId,
                request.name(), request.description(), request.priority(), request.status(), request.startDate(),
                request.targetEndDate(), request.projectGoal(), request.techStack(), request.organizationId()));
    }

    @PostMapping("/{projectId}/archive")
    @Operation(summary = "Archive a project", description = "PROJECT_MANAGER only. Requires CSRF. No hard delete is performed.")
    @ApiResponse(responseCode = "204", description = "Project archived")
    public ResponseEntity<Void> archive(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                        @PathVariable UUID projectId) {
        projects.archive(AuthenticatedActor.id(principal), projectId);
        return ResponseEntity.noContent().build();
    }

    private static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Invalid pagination");
        }
        return PageRequest.of(page, size, Sort.by("name").ascending());
    }
}
