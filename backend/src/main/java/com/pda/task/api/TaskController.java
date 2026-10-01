package com.pda.task.api;

import com.pda.task.application.TaskCommand;
import com.pda.task.application.TaskFilter;
import com.pda.task.application.TaskService;
import com.pda.task.application.TaskView;
import com.pda.task.domain.*;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/tasks")
public class TaskController {
    private final TaskService service;
    public TaskController(TaskService service) { this.service = service; }

    @PostMapping
    @Operation(summary = "Create task", description = "Active project TASK_MANAGE; CSRF header required")
    public ResponseEntity<TaskView> create(@PathVariable UUID projectId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody CreateRequest request) {
        TaskView view = service.create(projectId, actor(principal), request.toCommand());
        return ResponseEntity.created(URI.create("/api/v1/projects/" + projectId + "/tasks/" + view.id())).body(view);
    }

    @GetMapping
    @Operation(summary = "List active tasks", description = "PROJECT_VIEW; server-side filters; "
            + "sort: taskNumber, createdAt, updatedAt, deadlineAt, priority")
    public PageResponse list(@PathVariable UUID projectId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(required = false) Set<TaskStatus> status,
            @RequestParam(required = false) Set<TaskPriority> priority,
            @RequestParam(required = false) UUID assigneeId,
            @RequestParam(defaultValue = "false") boolean unassigned,
            @RequestParam(required = false) String q,
            @RequestParam(name = "labelId", required = false) Set<UUID> labelIds,
            @RequestParam(required = false) UUID sprintId,
            @RequestParam(defaultValue = "false") boolean backlog,
            @RequestParam(defaultValue = "false") boolean pool,
            @RequestParam(required = false) UUID parentId,
            @RequestParam(defaultValue = "false") boolean topLevel,
            @RequestParam(defaultValue = "false") boolean overdue,
            @RequestParam(defaultValue = "false") boolean blocked,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "updatedAt,desc") String sort) {
        SortSpec spec = SortSpec.parse(sort);
        TaskFilter filter = new TaskFilter(status, priority, assigneeId, unassigned, q, labelIds, sprintId, backlog,
                pool, parentId, topLevel, overdue, blocked);
        Page<TaskView> result = service.list(projectId, actor(principal), filter, spec.field(), spec.ascending(),
                page, size);
        return new PageResponse(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @GetMapping("/{taskId}")
    @Operation(summary = "Get task", description = "PROJECT_VIEW")
    public TaskView detail(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return service.detail(projectId, taskId, actor(principal));
    }

    @PatchMapping("/{taskId}")
    @Operation(summary = "Update task", description = "TASK_MANAGE; basic fields, parent and sprint are replaced "
            + "(null clears); assigneeIds, labelIds and pool are left alone when omitted")
    public TaskView update(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody UpdateRequest request) {
        return service.update(projectId, taskId, actor(principal), request.toCommand());
    }

    @PutMapping("/{taskId}/assignees")
    @Operation(summary = "Replace task assignees", description = "TASK_MANAGE; every assignee must be an active project member")
    public AssigneesResponse assignees(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody AssigneesRequest request) {
        return new AssigneesResponse(service.replaceAssignees(projectId, taskId, actor(principal),
                new HashSet<>(request.assigneeIds())));
    }

    @PatchMapping("/{taskId}/status")
    @Operation(summary = "Change task status", description = "TASK_MANAGE or assigned TASK_WORK; controlled transitions")
    public TaskView status(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody StatusRequest request) {
        return service.changeStatus(projectId, taskId, actor(principal), request.status());
    }

    @PatchMapping("/{taskId}/blocked")
    @Operation(summary = "Block or unblock task", description = "TASK_MANAGE or assigned TASK_WORK")
    public TaskView blocked(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody BlockedRequest request) {
        return service.setBlocked(projectId, taskId, actor(principal), request.blocked(), request.reason());
    }

    @PutMapping("/{taskId}/labels")
    @Operation(summary = "Replace task labels", description = "TASK_MANAGE; at most 10 active project labels")
    public TaskView labels(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody LabelsRequest request) {
        return service.replaceLabels(projectId, taskId, actor(principal), new HashSet<>(request.labelIds()));
    }

    @PutMapping("/{taskId}/sprint")
    @Operation(summary = "Move task to a sprint or the backlog", description = "TASK_MANAGE; sprintId null = backlog")
    public TaskView sprint(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody SprintRequest request) {
        return service.changeSprint(projectId, taskId, actor(principal), request.sprintId());
    }

    @GetMapping("/{taskId}/subtasks")
    @Operation(summary = "List subtasks", description = "PROJECT_VIEW; ordered by task number")
    public List<TaskView> subtasks(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return service.subtasks(projectId, taskId, actor(principal));
    }

    @GetMapping("/{taskId}/history")
    @Operation(summary = "Get task status history", description = "PROJECT_VIEW; chronological")
    public List<HistoryResponse> history(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return service.history(projectId, taskId, actor(principal)).stream().map(HistoryResponse::from).toList();
    }

    @DeleteMapping("/{taskId}")
    @Operation(summary = "Archive task", description = "TASK_MANAGE; soft delete, subtasks are archived with it")
    public ResponseEntity<Void> archive(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        service.archive(projectId, taskId, actor(principal));
        return ResponseEntity.noContent().build();
    }

    static UUID actor(UserAccounts.AuthenticatedUser principal) {
        if (principal == null || principal.id() == null) throw new AccessDeniedException("Authentication required");
        return principal.id();
    }

    /** {@code field,direction}; only whitelisted fields reach the query. */
    record SortSpec(String field, boolean ascending) {
        static SortSpec parse(String sort) {
            String[] parts = sort.split(",", -1);
            if (parts.length != 2 || !com.pda.task.infrastructure.TaskSpecifications.SORT_FIELDS.contains(parts[0])
                    || !(parts[1].equalsIgnoreCase("asc") || parts[1].equalsIgnoreCase("desc"))) {
                throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid sort");
            }
            return new SortSpec(parts[0], parts[1].equalsIgnoreCase("asc"));
        }
    }

    public record PoolBody(boolean open, UUID teamId) {}

    public record CreateRequest(@NotBlank @Size(max = 160) String title, @Size(max = 10000) String description,
                                TaskPriority priority, LocalDate startDate, Instant deadlineAt,
                                Integer estimatePoints, Integer timeEstimateMinutes,
                                @Size(max = 20) List<@NotNull UUID> assigneeIds,
                                @Size(max = 10) List<@NotNull UUID> labelIds, UUID parentTaskId, UUID sprintId,
                                @Valid PoolBody pool) {
        TaskCommand toCommand() {
            return new TaskCommand(new TaskDraft(title, description, priority, startDate, deadlineAt,
                    estimatePoints, timeEstimateMinutes), asSet(assigneeIds), asSet(labelIds), parentTaskId,
                    sprintId, pool == null ? null : new TaskCommand.PoolRequest(pool.open(), pool.teamId()));
        }
    }

    public record UpdateRequest(@NotBlank @Size(max = 160) String title, @Size(max = 10000) String description,
                                @NotNull TaskPriority priority, LocalDate startDate, Instant deadlineAt,
                                Integer estimatePoints, Integer timeEstimateMinutes,
                                @Size(max = 20) List<@NotNull UUID> assigneeIds,
                                @Size(max = 10) List<@NotNull UUID> labelIds, UUID parentTaskId, UUID sprintId,
                                @Valid PoolBody pool) {
        TaskCommand toCommand() {
            return new TaskCommand(new TaskDraft(title, description, priority, startDate, deadlineAt,
                    estimatePoints, timeEstimateMinutes), asSet(assigneeIds), asSet(labelIds), parentTaskId,
                    sprintId, pool == null ? null : new TaskCommand.PoolRequest(pool.open(), pool.teamId()));
        }
    }

    private static Set<UUID> asSet(List<UUID> ids) { return ids == null ? null : new HashSet<>(ids); }

    public record AssigneesRequest(@NotNull @Size(max = 20) List<@NotNull UUID> assigneeIds) {}
    public record LabelsRequest(@NotNull @Size(max = 10) List<@NotNull UUID> labelIds) {}
    public record SprintRequest(UUID sprintId) {}
    public record StatusRequest(@NotNull TaskStatus status) {}
    public record BlockedRequest(@NotNull Boolean blocked, @Size(max = 500) String reason) {}
    public record AssigneesResponse(Set<UUID> assigneeIds) {}
    public record PageResponse(List<TaskView> content, int page, int size, long totalElements, int totalPages) {}
    public record HistoryResponse(UUID id, TaskStatus previousStatus, TaskStatus newStatus,
                                  UUID changedBy, Instant changedAt) {
        static HistoryResponse from(TaskStatusHistory history) {
            return new HistoryResponse(history.getId(), history.getPreviousStatus(), history.getNewStatus(),
                    history.getChangedBy(), history.getChangedAt());
        }
    }
}
