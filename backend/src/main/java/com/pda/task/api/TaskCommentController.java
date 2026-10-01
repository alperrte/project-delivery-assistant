package com.pda.task.api;

import com.pda.task.application.TaskCommentService;
import com.pda.task.application.TaskCommentService.CommentView;
import com.pda.task.application.TaskCommentService.TimelineEntry;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/** Comments and the merged comment/event timeline of one task. */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/tasks/{taskId}")
public class TaskCommentController {
    private final TaskCommentService comments;

    public TaskCommentController(TaskCommentService comments) { this.comments = comments; }

    @GetMapping("/comments")
    @Operation(summary = "List comments", description = "PROJECT_VIEW; oldest first; deleted comments carry no body")
    public CommentPage list(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return CommentPage.of(comments.list(projectId, taskId, TaskController.actor(principal), page, size));
    }

    @PostMapping("/comments")
    @Operation(summary = "Add comment", description = "TASK_WORK; plain text, @[userId] mentions active members")
    public ResponseEntity<CommentView> create(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody CommentRequest request) {
        CommentView view = comments.create(projectId, taskId, TaskController.actor(principal), request.body());
        return ResponseEntity.created(URI.create("/api/v1/projects/" + projectId + "/tasks/" + taskId
                + "/comments/" + view.id())).body(view);
    }

    @PatchMapping("/comments/{commentId}")
    @Operation(summary = "Edit comment", description = "Author only")
    public CommentView edit(@PathVariable UUID projectId, @PathVariable UUID taskId, @PathVariable UUID commentId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody CommentRequest request) {
        return comments.edit(projectId, taskId, commentId, TaskController.actor(principal), request.body());
    }

    @DeleteMapping("/comments/{commentId}")
    @Operation(summary = "Delete comment", description = "Soft delete by the author or ISSUE_MANAGE")
    public ResponseEntity<Void> delete(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @PathVariable UUID commentId, @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        comments.delete(projectId, taskId, commentId, TaskController.actor(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/activity")
    @Operation(summary = "Task timeline", description = "PROJECT_VIEW; comments and events merged, newest first; "
            + "filter ALL|COMMENTS|EVENTS")
    public TimelinePage activity(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(defaultValue = "ALL") String filter,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size) {
        return TimelinePage.of(comments.timeline(projectId, taskId, TaskController.actor(principal),
                filter.toUpperCase(java.util.Locale.ROOT), page, size));
    }

    public record CommentRequest(@NotBlank @Size(max = 10000) String body) {}

    public record CommentPage(List<CommentView> content, int page, int size, long totalElements, int totalPages) {
        static CommentPage of(Page<CommentView> page) {
            return new CommentPage(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(),
                    page.getTotalPages());
        }
    }

    public record TimelinePage(List<TimelineEntry> content, int page, int size, long totalElements, int totalPages) {
        static TimelinePage of(Page<TimelineEntry> page) {
            return new TimelinePage(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(),
                    page.getTotalPages());
        }
    }
}
