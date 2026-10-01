package com.pda.task.sprint.api;

import com.pda.task.domain.TaskValidationException;
import com.pda.task.sprint.application.SprintService;
import com.pda.task.sprint.application.SprintService.SprintSummary;
import com.pda.task.sprint.application.SprintService.SprintView;
import com.pda.task.sprint.domain.SprintStatus;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/sprints")
public class SprintController {
    private final SprintService sprints;

    public SprintController(SprintService sprints) { this.sprints = sprints; }

    @GetMapping
    @Operation(summary = "List sprints", description = "PROJECT_VIEW; newest first, optional status filter")
    public List<SprintView> list(@PathVariable UUID projectId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(required = false) SprintStatus status) {
        return sprints.list(projectId, actor(principal), status);
    }

    @PostMapping
    @Operation(summary = "Create sprint", description = "TASK_MANAGE; starts as PLANNED")
    public ResponseEntity<SprintView> create(@PathVariable UUID projectId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody SprintRequest request) {
        SprintView view = sprints.create(projectId, actor(principal), request.name(), request.goal(),
                request.startDate(), request.endDate());
        return ResponseEntity.created(URI.create("/api/v1/projects/" + projectId + "/sprints/" + view.id()))
                .body(view);
    }

    @GetMapping("/{sprintId}")
    @Operation(summary = "Get sprint", description = "PROJECT_VIEW")
    public SprintView get(@PathVariable UUID projectId, @PathVariable UUID sprintId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return sprints.get(projectId, sprintId, actor(principal));
    }

    @PatchMapping("/{sprintId}")
    @Operation(summary = "Update sprint", description = "TASK_MANAGE; planned or active sprints only")
    public SprintView update(@PathVariable UUID projectId, @PathVariable UUID sprintId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody SprintRequest request) {
        return sprints.update(projectId, sprintId, actor(principal), request.name(), request.goal(),
                request.startDate(), request.endDate());
    }

    @PostMapping("/{sprintId}/start")
    @Operation(summary = "Start sprint", description = "TASK_MANAGE; only one sprint can be active")
    public SprintView start(@PathVariable UUID projectId, @PathVariable UUID sprintId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return sprints.start(projectId, sprintId, actor(principal));
    }

    @PostMapping("/{sprintId}/complete")
    @Operation(summary = "Complete sprint", description = "TASK_MANAGE; moveOpenTasksTo is a sprint id or BACKLOG")
    public SprintView complete(@PathVariable UUID projectId, @PathVariable UUID sprintId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody CompleteRequest request) {
        return sprints.complete(projectId, sprintId, actor(principal), request.target());
    }

    @GetMapping("/{sprintId}/summary")
    @Operation(summary = "Sprint summary", description = "PROJECT_VIEW; totals, status split, logged time, burndown")
    public SprintSummary summary(@PathVariable UUID projectId, @PathVariable UUID sprintId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return sprints.summary(projectId, sprintId, actor(principal));
    }

    @DeleteMapping("/{sprintId}")
    @Operation(summary = "Archive sprint", description = "TASK_MANAGE; only a planned sprint without tasks")
    public ResponseEntity<Void> archive(@PathVariable UUID projectId, @PathVariable UUID sprintId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        sprints.archive(projectId, sprintId, actor(principal));
        return ResponseEntity.noContent().build();
    }

    private static UUID actor(UserAccounts.AuthenticatedUser principal) {
        if (principal == null || principal.id() == null) throw new AccessDeniedException("Authentication required");
        return principal.id();
    }

    public record SprintRequest(@NotBlank @Size(max = 80) String name, @Size(max = 500) String goal,
                                @NotNull LocalDate startDate, @NotNull LocalDate endDate) {}

    public record CompleteRequest(@NotBlank String moveOpenTasksTo) {
        UUID target() {
            if (moveOpenTasksTo.equals("BACKLOG")) return null;
            try {
                return UUID.fromString(moveOpenTasksTo);
            } catch (IllegalArgumentException e) {
                throw new TaskValidationException("SPRINT_INVALID", "Invalid target sprint");
            }
        }
    }
}
