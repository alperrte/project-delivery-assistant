package com.pda.task.api;

import com.pda.task.application.TaskView.PersonRef;
import com.pda.task.application.TaskWatcherService;
import com.pda.task.application.TaskWatcherService.WatchState;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/tasks/{taskId}")
public class TaskWatcherController {
    private final TaskWatcherService watchers;

    public TaskWatcherController(TaskWatcherService watchers) { this.watchers = watchers; }

    @GetMapping("/watchers")
    @Operation(summary = "List task watchers", description = "PROJECT_VIEW")
    public List<PersonRef> list(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return watchers.list(projectId, taskId, TaskController.actor(principal));
    }

    @PutMapping("/watch")
    @Operation(summary = "Watch task", description = "PROJECT_VIEW; only for the caller, idempotent")
    public WatchState watch(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return watchers.watch(projectId, taskId, TaskController.actor(principal));
    }

    @DeleteMapping("/watch")
    @Operation(summary = "Stop watching task", description = "PROJECT_VIEW; only for the caller, idempotent")
    public WatchState unwatch(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return watchers.unwatch(projectId, taskId, TaskController.actor(principal));
    }
}
