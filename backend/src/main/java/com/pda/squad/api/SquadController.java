package com.pda.squad.api;

import com.pda.squad.api.dto.request.AddSquadMemberRequest;
import com.pda.squad.api.dto.request.CreateSquadRequest;
import com.pda.squad.api.dto.request.UpdateSquadRequest;
import com.pda.squad.api.dto.response.PageResponse;
import com.pda.squad.api.dto.response.SquadMemberResponse;
import com.pda.squad.api.dto.response.SquadResponse;
import com.pda.squad.application.service.SquadService;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/squads")
public class SquadController {

    private final SquadService squads;

    public SquadController(SquadService squads) {
        this.squads = squads;
    }

    @GetMapping
    @Operation(summary = "List active squads", description = "Project members only; paginated.")
    public PageResponse<SquadResponse> list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                           @PathVariable UUID projectId,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(squads.list(actorId(principal), projectId, pageRequest(page, size)),
                SquadResponse::from);
    }

    @PostMapping
    @Operation(summary = "Create a squad", description = "PROJECT_MANAGER only. Requires CSRF.")
    public ResponseEntity<SquadResponse> create(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                               @PathVariable UUID projectId,
                                               @Valid @RequestBody CreateSquadRequest request) {
        SquadResponse body = SquadResponse.from(squads.create(actorId(principal), projectId, request.name(),
                request.description()));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/{squadId}")
    @Operation(summary = "Get an active squad", description = "Project members only.")
    public SquadResponse detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                               @PathVariable UUID projectId, @PathVariable UUID squadId) {
        return SquadResponse.from(squads.detail(actorId(principal), projectId, squadId).team());
    }

    @PutMapping("/{squadId}")
    @Operation(summary = "Update a squad", description = "PROJECT_MANAGER only. Requires CSRF.")
    public SquadResponse update(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                               @PathVariable UUID projectId, @PathVariable UUID squadId,
                               @Valid @RequestBody UpdateSquadRequest request) {
        return SquadResponse.from(squads.update(actorId(principal), projectId, squadId, request.name(),
                request.description()).team());
    }

    @PostMapping("/{squadId}/archive")
    @Operation(summary = "Archive a squad", description = "PROJECT_MANAGER only. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Squad archived")
    public ResponseEntity<Void> archive(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId, @PathVariable UUID squadId) {
        squads.archive(actorId(principal), projectId, squadId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{squadId}/members")
    @Operation(summary = "List squad members", description = "Project members only; paginated.")
    public PageResponse<SquadMemberResponse> listMembers(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal, @PathVariable UUID projectId,
            @PathVariable UUID squadId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(squads.listMembers(actorId(principal), projectId, squadId,
                memberPageRequest(page, size)), SquadMemberResponse::from);
    }

    @PostMapping("/{squadId}/members")
    @Operation(summary = "Add a squad member", description = "PROJECT_MANAGER only; the target must already be an "
            + "active project member. Requires CSRF.")
    public ResponseEntity<SquadMemberResponse> addMember(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal, @PathVariable UUID projectId,
            @PathVariable UUID squadId, @Valid @RequestBody AddSquadMemberRequest request) {
        SquadMemberResponse body = SquadMemberResponse.from(
                squads.addMember(actorId(principal), projectId, squadId, request.userId()));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @DeleteMapping("/{squadId}/members/{userId}")
    @Operation(summary = "Remove a squad member", description = "PROJECT_MANAGER only. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Member removed from the squad")
    public ResponseEntity<Void> removeMember(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                            @PathVariable UUID projectId, @PathVariable UUID squadId,
                                            @PathVariable UUID userId) {
        squads.removeMember(actorId(principal), projectId, squadId, userId);
        return ResponseEntity.noContent().build();
    }

    private static UUID actorId(UserAccounts.AuthenticatedUser principal) {
        if (principal == null || principal.id() == null) {
            throw new AccessDeniedException("Authentication required");
        }
        return principal.id();
    }

    private static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Invalid pagination");
        }
        return PageRequest.of(page, size, Sort.by("createdAt").ascending());
    }

    private static PageRequest memberPageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Invalid pagination");
        }
        return PageRequest.of(page, size, Sort.by("addedAt").ascending());
    }
}
