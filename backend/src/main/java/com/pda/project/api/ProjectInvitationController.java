package com.pda.project.api;

import com.pda.project.api.dto.request.CreateInvitationRequest;
import com.pda.project.api.dto.request.InvitationTokenRequest;
import com.pda.project.api.dto.response.CreatedInvitationResponse;
import com.pda.project.api.dto.response.InvitationResponse;
import com.pda.project.api.dto.response.MemberResponse;
import com.pda.project.api.dto.response.PageResponse;
import com.pda.project.application.service.ProjectInvitationService;
import com.pda.project.application.service.ProjectInvitationService.CreatedInvitation;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/invitations")
public class ProjectInvitationController {

    private final ProjectInvitationService invitations;

    public ProjectInvitationController(ProjectInvitationService invitations) {
        this.invitations = invitations;
    }

    @GetMapping
    @Operation(summary = "List pending invitations", description = "PROJECT_MANAGER only; paginated.")
    public PageResponse<InvitationResponse> listPending(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                        @PathVariable UUID projectId,
                                                        @RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(invitations.listPending(AuthenticatedActor.id(principal), projectId,
                pageRequest(page, size)), InvitationResponse::from);
    }

    @GetMapping("/all")
    @Operation(summary = "List project invitation history including rejections", description = "PROJECT_MANAGER only; paginated")
    public PageResponse<InvitationResponse> listAll(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                    @PathVariable UUID projectId,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(invitations.listProject(AuthenticatedActor.id(principal), projectId,
                pageRequest(page, size)), InvitationResponse::from);
    }

    @PostMapping
    @Operation(summary = "Invite a registered user into the project", description = "PROJECT_MANAGER only. Requires CSRF. "
            + "Exactly one of userId or an existing account email must be set. The response carries the raw invitation token once; "
            + "it is never persisted or returned again.")
    public ResponseEntity<CreatedInvitationResponse> create(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal, @PathVariable UUID projectId,
            @Valid @RequestBody CreateInvitationRequest request) {
        boolean hasUserId = request.userId() != null;
        boolean hasEmail = request.email() != null && !request.email().isBlank();
        if (hasUserId == hasEmail) {
            throw new IllegalArgumentException("Exactly one of userId or email is required");
        }
        UUID actorId = AuthenticatedActor.id(principal);
        CreatedInvitation created = hasUserId
                ? invitations.inviteRegisteredUser(actorId, projectId, request.userId(), request.roles())
                : invitations.inviteByEmail(actorId, projectId, request.email(), request.roles());
        return ResponseEntity.status(HttpStatus.CREATED).body(CreatedInvitationResponse.from(created));
    }

    @PostMapping("/{invitationId}/resend")
    @Operation(summary = "Cancel a pending invitation and reissue it to the same target with a new token",
            description = "PROJECT_MANAGER only. Requires CSRF.")
    public CreatedInvitationResponse resend(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                           @PathVariable UUID projectId, @PathVariable UUID invitationId) {
        return CreatedInvitationResponse.from(
                invitations.resend(AuthenticatedActor.id(principal), projectId, invitationId));
    }

    @DeleteMapping("/{invitationId}")
    @Operation(summary = "Cancel a pending invitation", description = "PROJECT_MANAGER only. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Invitation cancelled")
    public ResponseEntity<Void> cancel(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                      @PathVariable UUID projectId, @PathVariable UUID invitationId) {
        invitations.cancel(AuthenticatedActor.id(principal), projectId, invitationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{invitationId}/reject")
    @Operation(summary = "Decline an invitation", description = "Authenticated; requires the invitation token from "
            + "the invite link. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Invitation rejected")
    public ResponseEntity<Void> reject(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                      @PathVariable UUID projectId, @PathVariable UUID invitationId,
                                      @Valid @RequestBody InvitationTokenRequest request) {
        invitations.reject(AuthenticatedActor.id(principal), projectId, invitationId, request.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{invitationId}/accept")
    @Operation(summary = "Accept an invitation and join the project", description = "Authenticated; requires the "
            + "invitation token from the invite link. Requires CSRF.")
    public MemberResponse accept(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                @PathVariable UUID projectId, @PathVariable UUID invitationId,
                                @Valid @RequestBody InvitationTokenRequest request) {
        return MemberResponse.from(invitations.accept(AuthenticatedActor.id(principal), projectId, invitationId,
                request.token()));
    }

    private static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Invalid pagination");
        }
        return PageRequest.of(page, size, Sort.by("createdAt").descending());
    }
}
