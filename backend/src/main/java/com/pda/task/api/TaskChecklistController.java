package com.pda.task.api;

import com.pda.task.application.TaskChecklistService;
import com.pda.task.application.TaskChecklistService.ChecklistItemView;
import com.pda.task.application.TaskPoolService;
import com.pda.task.application.TaskView;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/** Checklist and pool claiming of one task. */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/tasks/{taskId}")
public class TaskChecklistController {
    private final TaskChecklistService checklist;
    private final TaskPoolService pool;

    public TaskChecklistController(TaskChecklistService checklist, TaskPoolService pool) {
        this.checklist = checklist; this.pool = pool;
    }

    @GetMapping("/checklist")
    @Operation(summary = "List checklist items", description = "PROJECT_VIEW; ordered by position")
    public List<ChecklistItemView> list(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return checklist.list(projectId, taskId, TaskController.actor(principal));
    }

    @PostMapping("/checklist")
    @Operation(summary = "Add checklist item", description = "TASK_MANAGE or assigned TASK_WORK; at most 50 items")
    public ResponseEntity<ChecklistItemView> add(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody ItemRequest request) {
        ChecklistItemView view = checklist.add(projectId, taskId, TaskController.actor(principal), request.text());
        return ResponseEntity.created(URI.create("/api/v1/projects/" + projectId + "/tasks/" + taskId
                + "/checklist/" + view.id())).body(view);
    }

    @PatchMapping("/checklist/{itemId}")
    @Operation(summary = "Rename or tick a checklist item", description = "TASK_MANAGE or assigned TASK_WORK")
    public ChecklistItemView update(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @PathVariable UUID itemId, @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody ItemPatch request) {
        return checklist.update(projectId, taskId, itemId, TaskController.actor(principal), request.text(),
                request.done());
    }

    @DeleteMapping("/checklist/{itemId}")
    @Operation(summary = "Delete checklist item", description = "TASK_MANAGE or assigned TASK_WORK")
    public ResponseEntity<Void> delete(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @PathVariable UUID itemId, @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        checklist.delete(projectId, taskId, itemId, TaskController.actor(principal));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/checklist/order")
    @Operation(summary = "Reorder checklist", description = "TASK_MANAGE or assigned TASK_WORK; must list every item")
    public List<ChecklistItemView> reorder(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody OrderRequest request) {
        return checklist.reorder(projectId, taskId, TaskController.actor(principal), request.itemIds());
    }

    @PostMapping("/claim")
    @Operation(summary = "Claim a pool task", description = "TASK_WORK; atomic, a team-targeted task needs "
            + "membership of that team")
    public TaskView claim(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return pool.claim(projectId, taskId, TaskController.actor(principal));
    }

    @PostMapping("/release")
    @Operation(summary = "Return a claimed task to the pool", description = "Only the sole assignee who claimed it")
    public TaskView release(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return pool.release(projectId, taskId, TaskController.actor(principal));
    }

    public record ItemRequest(@NotBlank @Size(max = 200) String text) {}
    public record ItemPatch(@Size(max = 200) String text, Boolean done) {}
    public record OrderRequest(@NotNull @Size(max = 50) List<@NotNull UUID> itemIds) {}
}
