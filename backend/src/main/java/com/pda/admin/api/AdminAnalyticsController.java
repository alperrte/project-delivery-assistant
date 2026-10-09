package com.pda.admin.api;

import com.pda.admin.application.service.AdminAnalyticsService;
import com.pda.admin.application.service.AdminAuthorization;
import com.pda.user.PlatformPermission;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Administration dashboard: aggregates only, never a person, a message or a session. */
@RestController
@RequestMapping("/api/v1/admin/analytics")
public class AdminAnalyticsController {

    private final AdminAnalyticsService dashboard;
    private final AdminAuthorization authorization;

    public AdminAnalyticsController(AdminAnalyticsService dashboard, AdminAuthorization authorization) {
        this.dashboard = dashboard;
        this.authorization = authorization;
    }

    @GetMapping
    @Operation(summary = "Analytics dashboard",
            description = "ADMIN only. Inclusive day range `from`..`to` (at most 366 days; default the last 30 days) cut in "
                    + "the IANA time zone `zone` (default UTC). Traffic is built from consented, anonymous analytics; "
                    + "registrations, account counts and delivered contact messages come from their own records and do "
                    + "not depend on analytics consent. Failed mail deliveries are not counted.")
    @ApiResponse(responseCode = "200", description = "Overview, traffic, registrations, accounts and contact requests")
    @ApiResponse(responseCode = "400", description = "Unknown zone, inverted range or a range over 366 days")
    @ApiResponse(responseCode = "403", description = "Caller is not an administrator")
    public ResponseEntity<AdminAnalyticsService.Dashboard> analytics(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String zone) {
        authorization.require(principal, PlatformPermission.SYSTEM_VIEW);
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(dashboard.dashboard(from, to, zone));
    }
}
