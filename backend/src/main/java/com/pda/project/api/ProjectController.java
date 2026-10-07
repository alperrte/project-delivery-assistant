package com.pda.project.api;

import com.pda.project.api.dto.request.CreateProjectRequest;
import com.pda.project.api.dto.request.UpdateProjectRequest;
import com.pda.project.api.dto.response.PageResponse;
import com.pda.project.api.dto.response.ProjectHomeResponse;
import com.pda.project.api.dto.response.ProjectResponse;
import com.pda.project.application.service.ProjectHomeService;
import com.pda.project.application.service.ProjectService;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
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
    private final ProjectHomeService projectHome;

    public ProjectController(ProjectService projects, ProjectHomeService projectHome) {
        this.projects = projects;
        this.projectHome = projectHome;
    }

    @PostMapping
    @Operation(summary = "Create a project", description = "Authenticated creator becomes its first PROJECT_MANAGER. Requires CSRF.")
    @ApiResponse(responseCode = "201", description = "Project and first manager membership created")
    public ResponseEntity<ProjectResponse> create(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody CreateProjectRequest request) {
        ProjectResponse response = ProjectResponse.from(projects.create(AuthenticatedActor.id(principal),
                request.name(), request.description(), request.organizationId(), request.projectType(),
                request.tagline(), request.techStack()));
        return ResponseEntity.created(URI.create("/api/v1/projects/" + response.id())).body(response);
    }

    @GetMapping
    @Operation(summary = "List own projects", description = "Only active projects with a membership are returned. "
            + "Each item also carries the card data (team count and preview, last editor), aggregated for the "
            + "whole page in a fixed number of queries.")
    public PageResponse<ProjectResponse> list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(projects.listCards(AuthenticatedActor.id(principal), pageRequest(page, size)),
                ProjectResponse::from);
    }

    @GetMapping("/{projectId}")
    @Operation(summary = "Get a project", description = "Requires membership in this project.")
    public ProjectResponse detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                  @PathVariable UUID projectId) {
        return ProjectResponse.from(projects.detail(AuthenticatedActor.id(principal), projectId));
    }

    @GetMapping("/{projectId}/home")
    @Operation(summary = "Get the Project Home aggregate", description = "Project-only data: header, "
            + "status/priority, organization, managers, team/squad counts, success-criteria progress and "
            + "repository summary. Task counts and recent activity are out of scope until Work Service and "
            + "Activity expose their own contracts. Requires membership in this project.")
    public ProjectHomeResponse home(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                    @PathVariable UUID projectId) {
        return ProjectHomeResponse.from(projectHome.summary(AuthenticatedActor.id(principal), projectId));
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
                request.targetEndDate(), request.projectGoal(), request.techStack(), request.organizationId(),
                request.projectType(), request.tagline()));
    }

    @org.springframework.web.bind.annotation.PatchMapping("/{projectId}/task-management-mode")
    @Operation(summary = "Choose the project task model", description = "Active project founder only, not other managers or global ADMIN. Requires CSRF.")
    public ProjectResponse taskManagementMode(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @PathVariable UUID projectId,
                                              @Valid @RequestBody com.pda.project.api.dto.request.TaskManagementModeRequest request) {
        return ProjectResponse.from(projects.changeTaskManagementMode(AuthenticatedActor.id(principal), projectId, request.mode()));
    }

    @PostMapping("/{projectId}/archive")
    @Operation(summary = "Archive a project", description = "PROJECT_MANAGER only. Requires CSRF. Soft delete: the "
            + "project disappears but its data is kept. The web app no longer offers it; use DELETE to remove a project.")
    @ApiResponse(responseCode = "204", description = "Project archived")
    public ResponseEntity<Void> archive(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                        @PathVariable UUID projectId) {
        projects.archive(AuthenticatedActor.id(principal), projectId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{projectId}")
    @Operation(summary = "Permanently delete a project", description = "Active project founder who is still a "
            + "PROJECT_MANAGER only, not other managers or global ADMIN. Requires CSRF. Irreversible: the project and "
            + "everything in it (members, teams, invitations, tasks, comments, attachments, chat, criteria, "
            + "reminders, logo and banner) is removed, and its notifications are cleared. Archived projects are 404.")
    @ApiResponse(responseCode = "204", description = "Project and all of its data deleted")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId) {
        projects.delete(AuthenticatedActor.id(principal), projectId);
        return ResponseEntity.noContent().build();
    }

    private static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Invalid pagination");
        }
        return PageRequest.of(page, size, Sort.by("name").ascending());
    }
}
