package com.pda.task.api;

import com.pda.task.application.MyTasksService;
import com.pda.task.application.MyTasksService.Counts;
import com.pda.task.application.MyTasksService.MyTasksPage;
import com.pda.task.application.MyTasksService.Scope;
import com.pda.task.application.TaskPoolService;
import com.pda.task.application.TaskView;
import com.pda.task.domain.TaskStatus;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.data.domain.Page;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Cross-project views for the signed-in user. There is deliberately no user id parameter anywhere. */
@RestController
@RequestMapping("/api/v1/tasks")
public class MyTasksController {
    private final MyTasksService myTasks;
    private final TaskPoolService pool;

    public MyTasksController(MyTasksService myTasks, TaskPoolService pool) {
        this.myTasks = myTasks; this.pool = pool;
    }

    @GetMapping("/mine")
    @Operation(summary = "My tasks", description = "Tasks assigned to the caller in active projects, with counts")
    public MyTasksPage mine(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(defaultValue = "OPEN") Scope scope,
            @RequestParam(required = false) Set<TaskStatus> status,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(defaultValue = "false") boolean overdue,
            @RequestParam(required = false) String sprint,
            @RequestParam(defaultValue = "deadlineAt") String sort,
            @RequestParam(defaultValue = "asc") String direction,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return myTasks.mine(TaskController.actor(principal), scope, status, projectId, overdue,
                "active".equalsIgnoreCase(sprint), sort, !"desc".equalsIgnoreCase(direction), page, size);
    }

    @GetMapping("/counts")
    @Operation(summary = "My task counts", description = "Open, overdue, due soon, blocked and claimable pool tasks")
    public Counts counts(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return myTasks.counts(TaskController.actor(principal));
    }

    @GetMapping("/pool")
    @Operation(summary = "Claimable pool tasks", description = "Open pool tasks the caller may claim, across projects")
    public TaskController.PageResponse pool(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<TaskView> result = pool.available(TaskController.actor(principal), projectId, page, size);
        List<TaskView> content = result.getContent();
        return new TaskController.PageResponse(content, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }
}
