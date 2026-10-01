package com.pda.project.api;

import com.pda.project.api.dto.response.MemberResponse;
import com.pda.project.api.dto.response.PageResponse;
import com.pda.project.application.service.ProjectInvitationService;
import com.pda.project.application.service.ProjectLogoService;
import com.pda.project.application.service.InvitationSummary;
import com.pda.project.domain.enums.InvitationStatus;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/project-invitations")
public class MyProjectInvitationController {
    private final ProjectInvitationService invitations;
    public MyProjectInvitationController(ProjectInvitationService invitations) { this.invitations = invitations; }

    @GetMapping("/me")
    @Operation(summary = "List my project invitations", description = "Authenticated recipient only; paginated")
    public PageResponse<MyInvitationResponse> mine(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(invitations.listMine(AuthenticatedActor.id(principal), page(page, size)), item -> {
            InvitationSummary i = item.invitation();
            return new MyInvitationResponse(i.id(), i.projectId(), item.projectName(), i.invitedBy(),
                    item.invitedByNickname(), i.initialRoles(), i.status(), i.createdAt(), i.expiresAt(),
                    i.message(), i.teamName());
        });
    }

    @GetMapping("/{invitationId}/preview")
    @Operation(summary = "Preview the project of my invitation", description = "Recipient only; card-level data, no project membership granted")
    public ResponseEntity<ProjectInvitationService.InvitationProjectPreview> preview(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal, @PathVariable UUID invitationId) {
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(invitations.previewMine(AuthenticatedActor.id(principal), invitationId));
    }

    @GetMapping("/{invitationId}/logo")
    @Operation(summary = "Preview the project logo of my invitation", description = "Recipient only; no project membership granted")
    public ResponseEntity<byte[]> previewLogo(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @PathVariable UUID invitationId) {
        ProjectLogoService.StoredLogo logo = invitations.previewLogoMine(AuthenticatedActor.id(principal), invitationId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(logo.contentType()))
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"logo\"")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store").body(logo.data());
    }

    @PostMapping("/{invitationId}/accept")
    @Operation(summary = "Accept my pending invitation", description = "Recipient only; CSRF; no token needed")
    public MemberResponse accept(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                 @PathVariable UUID invitationId) {
        return MemberResponse.from(invitations.acceptMine(AuthenticatedActor.id(principal), invitationId));
    }

    @PostMapping("/{invitationId}/reject")
    @Operation(summary = "Reject my pending invitation", description = "Recipient only; optional message up to 500; CSRF")
    public ResponseEntity<Void> reject(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID invitationId,
                                       @Valid @RequestBody(required = false) RejectRequest request) {
        invitations.rejectMine(AuthenticatedActor.id(principal), invitationId,
                request == null ? null : request.message());
        return ResponseEntity.noContent().build();
    }

    private static PageRequest page(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Invalid pagination");
        return PageRequest.of(page, size, Sort.by("createdAt").descending());
    }
    public record RejectRequest(@Size(max = 500) String message) {}
    public record MyInvitationResponse(UUID id, UUID projectId, String projectName, UUID invitedBy,
                                       String invitedByNickname, Set<ProjectRole> initialRoles,
                                       InvitationStatus status, Instant createdAt, Instant expiresAt,
                                       String message, String teamName) {}
}
