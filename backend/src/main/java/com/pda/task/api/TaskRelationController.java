package com.pda.task.api;

import com.pda.task.application.TaskRelationService;
import com.pda.task.application.TaskRelationService.RelationsView;
import com.pda.task.domain.RelationType;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/tasks/{taskId}/relations")
public class TaskRelationController {
    private final TaskRelationService relations;

    public TaskRelationController(TaskRelationService relations) { this.relations = relations; }

    @GetMapping
    @Operation(summary = "List task relations", description = "PROJECT_VIEW; grouped by direction")
    public RelationsView list(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return relations.list(projectId, taskId, TaskController.actor(principal));
    }

    @PostMapping
    @Operation(summary = "Add task relation", description = "TASK_MANAGE or assigned TASK_WORK on the source; "
            + "BLOCKS loops are refused")
    public ResponseEntity<RelationsView> add(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody RelationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(relations.add(projectId, taskId,
                TaskController.actor(principal), request.type(), request.targetTaskId()));
    }

    @DeleteMapping("/{relationId}")
    @Operation(summary = "Remove task relation", description = "TASK_MANAGE or assigned TASK_WORK")
    public RelationsView remove(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @PathVariable UUID relationId, @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return relations.remove(projectId, taskId, relationId, TaskController.actor(principal));
    }

    public record RelationRequest(@NotNull RelationType type, @NotNull UUID targetTaskId) {}
}
