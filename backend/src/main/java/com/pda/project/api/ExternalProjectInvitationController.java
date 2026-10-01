package com.pda.project.api;

import com.pda.project.ProjectInvitationOnboarding;
import com.pda.project.api.dto.request.InvitationTokenRequest;
import com.pda.user.UserAccounts;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/project-invitations/external")
public class ExternalProjectInvitationController {
    private final ProjectInvitationOnboarding onboarding;

    public ExternalProjectInvitationController(ProjectInvitationOnboarding onboarding) {
        this.onboarding = onboarding;
    }

    @PostMapping("/preview")
    public ResponseEntity<ProjectInvitationOnboarding.Preview> preview(
            @Valid @RequestBody InvitationTokenRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(onboarding.preview(request.token()));
    }

    @PostMapping("/accept")
    public ResponseEntity<ProjectInvitationOnboarding.Accepted> accept(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody InvitationTokenRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(onboarding.acceptExistingAccount(request.token(), AuthenticatedActor.id(principal)));
    }
}
