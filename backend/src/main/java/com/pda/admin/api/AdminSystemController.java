package com.pda.admin.api;

import com.pda.admin.application.service.AdminAuthorization;
import com.pda.admin.application.service.SystemStatusService;
import com.pda.project.ProjectOverview;
import com.pda.user.PlatformPermission;
import com.pda.user.UserAccounts;
import com.pda.user.UserAdministration;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Platform-wide read-only overview for administrators: aggregate metadata only, never project content or secrets. */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminSystemController {

    private static final int MAX_PAGE_SIZE = 100;

    private final UserAdministration users;
    private final ProjectOverview projects;
    private final SystemStatusService status;
    private final AdminAuthorization authorization;

    public AdminSystemController(UserAdministration users, ProjectOverview projects, SystemStatusService status,
                                 AdminAuthorization authorization) {
        this.users = users;
        this.projects = projects;
        this.status = status;
        this.authorization = authorization;
    }

    @GetMapping("/overview")
    @Operation(summary = "Platform overview", description = "ADMIN only. User and project counts.")
    @ApiResponse(responseCode = "200", description = "Aggregate counts")
    @ApiResponse(responseCode = "403", description = "Caller is not an administrator")
    public ResponseEntity<Overview> overview(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        authorization.require(principal, PlatformPermission.SYSTEM_VIEW);
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(new Overview(users.counts(), projects.counts()));
    }

    @GetMapping("/projects")
    @Operation(summary = "Project overview list",
            description = "ADMIN only. Name, status and active member count only; no project content and no access path into a project.")
    @ApiResponse(responseCode = "200", description = "One page of project summaries")
    public ResponseEntity<ProjectOverview.ProjectPage> projects(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        authorization.require(principal, PlatformPermission.SYSTEM_VIEW);
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(projects.list(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE)));
    }

    @GetMapping("/system/status")
    @Operation(summary = "System status",
            description = "ADMIN only. Database reachability and which optional features are configured, as booleans; never secret values.")
    @ApiResponse(responseCode = "200", description = "Status booleans")
    public ResponseEntity<SystemStatusService.Status> systemStatus(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        authorization.require(principal, PlatformPermission.SYSTEM_VIEW);
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(status.status());
    }

    public record Overview(UserAdministration.UserCounts users, ProjectOverview.ProjectCounts projects) {}
}
