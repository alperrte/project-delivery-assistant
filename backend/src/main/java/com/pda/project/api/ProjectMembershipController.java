package com.pda.project.api;

import com.pda.project.api.dto.request.ReplaceRolesRequest;
import com.pda.project.api.dto.request.RoleRequest;
import com.pda.project.api.dto.response.MemberResponse;
import com.pda.project.api.dto.response.PageResponse;
import com.pda.project.api.dto.response.UserSearchResponse;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/members")
public class ProjectMembershipController {

    private final ProjectMembershipService memberships;

    public ProjectMembershipController(ProjectMembershipService memberships) {
        this.memberships = memberships;
    }

    @GetMapping
    @Operation(summary = "List active project members", description = "Project members only; paginated.")
    public PageResponse<MemberResponse> list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                            @PathVariable UUID projectId,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(memberships.list(AuthenticatedActor.id(principal), projectId,
                pageRequest(page, size)), MemberResponse::from);
    }

    @GetMapping("/search")
    @Operation(summary = "Search active users to add as a project member",
            description = "PROJECT_MANAGER only. Nickname substring match, or exact email match when the query "
                    + "contains '@'. Queries shorter than 2 characters return an empty list.")
    public List<UserSearchResponse> search(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                          @PathVariable UUID projectId, @RequestParam String query) {
        return memberships.searchAddableUsers(AuthenticatedActor.id(principal), projectId, query).stream()
                .map(UserSearchResponse::from).toList();
    }

    @GetMapping("/{userId}")
    @Operation(summary = "Get an active project member", description = "Project members only.")
    public MemberResponse detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                @PathVariable UUID projectId, @PathVariable UUID userId) {
        return MemberResponse.from(memberships.detail(AuthenticatedActor.id(principal), projectId, userId));
    }

    @PostMapping("/{userId}/roles")
    @Operation(summary = "Add one role to a member", description = "PROJECT_MANAGER only. Requires CSRF.")
    public MemberResponse addRole(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                 @PathVariable UUID projectId, @PathVariable UUID userId,
                                 @Valid @RequestBody RoleRequest request) {
        return MemberResponse.from(memberships.addRole(AuthenticatedActor.id(principal), projectId,
                userId, request.role()));
    }

    @PutMapping("/{userId}/roles")
    @Operation(summary = "Replace a member's role set", description = "PROJECT_MANAGER only. Requires CSRF.")
    public MemberResponse replaceRoles(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                      @PathVariable UUID projectId, @PathVariable UUID userId,
                                      @Valid @RequestBody ReplaceRolesRequest request) {
        return MemberResponse.from(memberships.replaceRoles(AuthenticatedActor.id(principal), projectId,
                userId, request.roles()));
    }

    @DeleteMapping("/{userId}/roles/{role}")
    @Operation(summary = "Remove one role from a member", description = "PROJECT_MANAGER only. Requires CSRF.")
    public MemberResponse removeRole(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                    @PathVariable UUID projectId, @PathVariable UUID userId,
                                    @PathVariable ProjectRole role) {
        return MemberResponse.from(memberships.removeRole(AuthenticatedActor.id(principal), projectId,
                userId, role));
    }

    @DeleteMapping("/{userId}")
    @Operation(summary = "Remove a project member", description = "PROJECT_MANAGER only. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Membership marked removed")
    public ResponseEntity<Void> removeMember(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                             @PathVariable UUID projectId, @PathVariable UUID userId) {
        memberships.removeMember(AuthenticatedActor.id(principal), projectId, userId);
        return ResponseEntity.noContent().build();
    }

    private static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Invalid pagination");
        }
        return PageRequest.of(page, size, Sort.by("joinedAt").ascending());
    }
}
