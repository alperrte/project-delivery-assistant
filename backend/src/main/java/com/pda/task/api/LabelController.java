package com.pda.task.api;

import com.pda.task.application.LabelService;
import com.pda.task.application.LabelService.LabelView;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/labels")
public class LabelController {
    private final LabelService labels;

    public LabelController(LabelService labels) { this.labels = labels; }

    @GetMapping
    @Operation(summary = "List project labels", description = "PROJECT_VIEW; active labels by name with usage counts")
    public List<LabelView> list(@PathVariable UUID projectId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return labels.list(projectId, TaskController.actor(principal));
    }

    @PostMapping
    @Operation(summary = "Create label", description = "LABEL_MANAGE; color is a fixed token")
    public ResponseEntity<LabelView> create(@PathVariable UUID projectId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody LabelRequest request) {
        LabelView view = labels.create(projectId, TaskController.actor(principal), request.name(), request.color());
        return ResponseEntity.created(URI.create("/api/v1/projects/" + projectId + "/labels/" + view.id())).body(view);
    }

    @PatchMapping("/{labelId}")
    @Operation(summary = "Update label", description = "LABEL_MANAGE")
    public LabelView update(@PathVariable UUID projectId, @PathVariable UUID labelId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody LabelRequest request) {
        return labels.update(projectId, labelId, TaskController.actor(principal), request.name(), request.color());
    }

    @DeleteMapping("/{labelId}")
    @Operation(summary = "Archive label", description = "LABEL_MANAGE; existing task tags are kept")
    public ResponseEntity<Void> archive(@PathVariable UUID projectId, @PathVariable UUID labelId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        labels.archive(projectId, labelId, TaskController.actor(principal));
        return ResponseEntity.noContent().build();
    }

    public record LabelRequest(@NotBlank @Size(max = 40) String name,
                               @NotBlank @Pattern(regexp = "slate|red|orange|amber|green|teal|blue|violet|pink")
                               String color) {}
}
