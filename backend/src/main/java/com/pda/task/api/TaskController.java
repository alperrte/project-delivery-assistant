package com.pda.task.api;

import com.pda.task.application.TaskService;
import com.pda.task.domain.*;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
    public ResponseEntity<TaskResponse> create(@PathVariable UUID projectId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody CreateRequest request) {
        TaskResponse response = view(projectId, actor(principal), service.create(projectId, actor(principal),
                request.title(), request.description(), request.priority(), request.startDate(), request.dueDate()));
        return ResponseEntity.created(URI.create("/api/v1/projects/" + projectId + "/tasks/" + response.id()))
                .body(response);
    }

    @GetMapping
    @Operation(summary = "List active tasks", description = "PROJECT_VIEW; sort: taskNumber, createdAt, updatedAt, dueDate")
    public PageResponse list(@PathVariable UUID projectId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "updatedAt,desc") String sort) {
        if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Invalid page");
        String[] parts = sort.split(",", -1);
        if (parts.length != 2 || !Set.of("taskNumber", "createdAt", "updatedAt", "dueDate").contains(parts[0])
                || !(parts[1].equalsIgnoreCase("asc") || parts[1].equalsIgnoreCase("desc"))) {
            throw new IllegalArgumentException("Invalid sort");
        }
        Sort.Direction direction = parts[1].equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC;
        Page<Task> result = service.list(projectId, actor(principal),
                PageRequest.of(page, size, Sort.by(direction, parts[0])));
        Map<UUID, Set<UUID>> assignees = service.assigneesForTasks(projectId, actor(principal),
                result.getContent().stream().map(Task::getId).toList());
        return new PageResponse(result.getContent().stream()
                .map(task -> TaskResponse.from(task, assignees.getOrDefault(task.getId(), Set.of()))).toList(), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @GetMapping("/{taskId}")
    @Operation(summary = "Get task", description = "PROJECT_VIEW")
    public TaskResponse detail(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return view(projectId, actor(principal), service.detail(projectId, taskId, actor(principal)));
    }

    @PatchMapping("/{taskId}")
    @Operation(summary = "Update basic task fields", description = "TASK_MANAGE; full basic-field replacement")
    public TaskResponse update(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody UpdateRequest request) {
        return view(projectId, actor(principal), service.update(projectId, taskId, actor(principal), request.title(),
                request.description(), request.priority(), request.startDate(), request.dueDate()));
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
    public TaskResponse status(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody StatusRequest request) {
        return view(projectId, actor(principal), service.changeStatus(projectId, taskId, actor(principal), request.status()));
    }

    @PatchMapping("/{taskId}/blocked")
    @Operation(summary = "Block or unblock task", description = "TASK_MANAGE or assigned TASK_WORK")
    public TaskResponse blocked(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody BlockedRequest request) {
        return view(projectId, actor(principal), service.setBlocked(projectId, taskId, actor(principal),
                request.blocked(), request.reason()));
    }

    @GetMapping("/{taskId}/history")
    @Operation(summary = "Get task status history", description = "PROJECT_VIEW; chronological")
    public List<HistoryResponse> history(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return service.history(projectId, taskId, actor(principal)).stream().map(HistoryResponse::from).toList();
    }

    @DeleteMapping("/{taskId}")
    @Operation(summary = "Archive task", description = "TASK_MANAGE; soft delete")
    public ResponseEntity<Void> archive(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        service.archive(projectId, taskId, actor(principal));
        return ResponseEntity.noContent().build();
    }

    private static UUID actor(UserAccounts.AuthenticatedUser principal) {
        if (principal == null || principal.id() == null) throw new AccessDeniedException("Authentication required");
        return principal.id();
    }

    private TaskResponse view(UUID projectId, UUID actor, Task task) {
        Set<UUID> assignees = service.assigneesForTasks(projectId, actor, List.of(task.getId()))
                .getOrDefault(task.getId(), Set.of());
        return TaskResponse.from(task, assignees);
    }

    public record CreateRequest(@NotBlank @Size(max = 160) String title, String description,
                                TaskPriority priority, LocalDate startDate, LocalDate dueDate) {}
    public record UpdateRequest(@NotBlank @Size(max = 160) String title, String description,
                                @NotNull TaskPriority priority, LocalDate startDate, LocalDate dueDate) {}
    public record AssigneesRequest(@NotNull List<@NotNull UUID> assigneeIds) {}
    public record StatusRequest(@NotNull TaskStatus status) {}
    public record BlockedRequest(@NotNull Boolean blocked, @Size(max = 500) String reason) {}
    public record AssigneesResponse(Set<UUID> assigneeIds) {}
    public record PageResponse(List<TaskResponse> content, int page, int size, long totalElements, int totalPages) {}
    public record HistoryResponse(UUID id, TaskStatus previousStatus, TaskStatus newStatus,
                                  UUID changedBy, Instant changedAt) {
        static HistoryResponse from(TaskStatusHistory history) {
            return new HistoryResponse(history.getId(), history.getPreviousStatus(), history.getNewStatus(),
                    history.getChangedBy(), history.getChangedAt());
        }
    }
    public record TaskResponse(UUID id, UUID projectId, long taskNumber, String taskKey, String title,
                               String description, TaskStatus status, TaskPriority priority,
                               LocalDate startDate, LocalDate dueDate, boolean blocked, String blockedReason,
                               UUID createdBy, Instant createdAt, UUID updatedBy, Instant updatedAt,
                               Instant archivedAt, long version, Set<UUID> assigneeIds) {
        static TaskResponse from(Task task, Set<UUID> assigneeIds) {
            return new TaskResponse(task.getId(), task.getProjectId(), task.getTaskNumber(), task.getTaskKey(),
                    task.getTitle(), task.getDescription(), task.getStatus(), task.getPriority(),
                    task.getStartDate(), task.getDueDate(), task.isBlocked(), task.getBlockedReason(),
                    task.getCreatedBy(), task.getCreatedAt(), task.getUpdatedBy(), task.getUpdatedAt(),
                    task.getArchivedAt(), task.getVersion(), assigneeIds);
        }
    }
}
