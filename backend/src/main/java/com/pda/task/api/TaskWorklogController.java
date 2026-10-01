package com.pda.task.api;

import com.pda.task.application.TaskWorklogService;
import com.pda.task.application.TaskWorklogService.WorklogList;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/tasks/{taskId}/worklogs")
public class TaskWorklogController {
    private final TaskWorklogService worklogs;

    public TaskWorklogController(TaskWorklogService worklogs) { this.worklogs = worklogs; }

    @GetMapping
    @Operation(summary = "List worklogs", description = "PROJECT_VIEW; newest work date first with the total")
    public WorklogList list(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return worklogs.list(projectId, taskId, TaskController.actor(principal));
    }

    @PostMapping
    @Operation(summary = "Log time", description = "TASK_MANAGE or assigned TASK_WORK; 1-1440 minutes, "
            + "work date at most one day past the UTC date")
    public ResponseEntity<WorklogList> add(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody WorklogRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(worklogs.add(projectId, taskId,
                TaskController.actor(principal), request.minutes(), request.workDate(), request.note()));
    }

    @PatchMapping("/{worklogId}")
    @Operation(summary = "Edit worklog", description = "Owner or TASK_MANAGE")
    public WorklogList update(@PathVariable UUID projectId, @PathVariable UUID taskId, @PathVariable UUID worklogId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody WorklogRequest request) {
        return worklogs.update(projectId, taskId, worklogId, TaskController.actor(principal), request.minutes(),
                request.workDate(), request.note());
    }

    @DeleteMapping("/{worklogId}")
    @Operation(summary = "Delete worklog", description = "Owner or TASK_MANAGE; soft delete")
    public WorklogList delete(@PathVariable UUID projectId, @PathVariable UUID taskId, @PathVariable UUID worklogId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return worklogs.delete(projectId, taskId, worklogId, TaskController.actor(principal));
    }

    public record WorklogRequest(@NotNull @Min(1) @Max(1440) Integer minutes, @NotNull LocalDate workDate,
                                 @Size(max = 500) String note) {}
}
