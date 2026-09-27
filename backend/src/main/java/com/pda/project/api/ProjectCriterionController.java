package com.pda.project.api;

import com.pda.project.api.dto.request.CreateCriterionRequest;
import com.pda.project.api.dto.request.ReorderCriteriaRequest;
import com.pda.project.api.dto.request.UpdateCriterionRequest;
import com.pda.project.api.dto.response.CriterionResponse;
import com.pda.project.application.service.ProjectCriterionService;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/criteria")
public class ProjectCriterionController {

    private final ProjectCriterionService criteria;

    public ProjectCriterionController(ProjectCriterionService criteria) {
        this.criteria = criteria;
    }

    @GetMapping
    @Operation(summary = "List success criteria in display order", description = "Project members only.")
    public List<CriterionResponse> list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId) {
        return criteria.list(AuthenticatedActor.id(principal), projectId).stream()
                .map(CriterionResponse::from).toList();
    }

    @PostMapping
    @Operation(summary = "Add a success criterion", description = "PROJECT_MANAGER only. Requires CSRF.")
    public ResponseEntity<CriterionResponse> create(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                    @PathVariable UUID projectId,
                                                    @Valid @RequestBody CreateCriterionRequest request) {
        CriterionResponse body = CriterionResponse.from(criteria.create(AuthenticatedActor.id(principal), projectId,
                request.title(), request.description()));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PutMapping("/{criterionId}")
    @Operation(summary = "Update a success criterion", description = "PROJECT_MANAGER only. Requires CSRF.")
    public CriterionResponse update(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                   @PathVariable UUID projectId, @PathVariable UUID criterionId,
                                   @Valid @RequestBody UpdateCriterionRequest request) {
        return CriterionResponse.from(criteria.update(AuthenticatedActor.id(principal), projectId, criterionId,
                request.title(), request.description()));
    }

    @DeleteMapping("/{criterionId}")
    @Operation(summary = "Delete a success criterion", description = "PROJECT_MANAGER only. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Criterion deleted")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                      @PathVariable UUID projectId, @PathVariable UUID criterionId) {
        criteria.delete(AuthenticatedActor.id(principal), projectId, criterionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{criterionId}/complete")
    @Operation(summary = "Mark a criterion completed", description = "PROJECT_MANAGER only. Requires CSRF.")
    public CriterionResponse complete(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                     @PathVariable UUID projectId, @PathVariable UUID criterionId) {
        return CriterionResponse.from(criteria.complete(AuthenticatedActor.id(principal), projectId, criterionId));
    }

    @PostMapping("/{criterionId}/uncomplete")
    @Operation(summary = "Mark a criterion incomplete again", description = "PROJECT_MANAGER only. Requires CSRF.")
    public CriterionResponse uncomplete(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId, @PathVariable UUID criterionId) {
        return CriterionResponse.from(criteria.uncomplete(AuthenticatedActor.id(principal), projectId, criterionId));
    }

    @PostMapping("/reorder")
    @Operation(summary = "Reorder success criteria", description = "PROJECT_MANAGER only; the request must list "
            + "every criterion of the project exactly once. Requires CSRF.")
    public List<CriterionResponse> reorder(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                          @PathVariable UUID projectId,
                                          @Valid @RequestBody ReorderCriteriaRequest request) {
        return criteria.reorder(AuthenticatedActor.id(principal), projectId, request.orderedCriterionIds()).stream()
                .map(CriterionResponse::from).toList();
    }
}
