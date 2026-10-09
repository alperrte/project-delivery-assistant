package com.pda.analytics.api;

import com.pda.analytics.api.dto.request.AnalyticsEventRequest;
import com.pda.analytics.application.service.AnalyticsIngestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public, anonymous, consent-gated visit events. It reads no identity from the request and returns nothing. */
@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsEventController {

    private final AnalyticsIngestService ingest;

    public AnalyticsEventController(AnalyticsIngestService ingest) {
        this.ingest = ingest;
    }

    @PostMapping("/events")
    @Operation(summary = "Record an anonymous analytics event",
            description = "Public with CSRF, rate limited per address, body of at most 2 KB. Types PAGE_VIEW and "
                    + "ENGAGEMENT only. Carries a random visitor/session id, the route template, and (first page of "
                    + "a session) the referrer host and UTM values. The browser sends it only after the person "
                    + "allowed analytics. No user, role or account field is read; the server uses its own clock.")
    @ApiResponse(responseCode = "204", description = "Recorded (or dropped because a per-session limit was reached)")
    @ApiResponse(responseCode = "400", description = "Invalid or unknown event")
    @ApiResponse(responseCode = "404", description = "ENGAGEMENT for a session the server does not know")
    @ApiResponse(responseCode = "413", description = "Body larger than 2 KB")
    @ApiResponse(responseCode = "429", description = "Rate limit exceeded")
    public ResponseEntity<Void> record(@Valid @RequestBody AnalyticsEventRequest request) {
        ingest.record(new AnalyticsIngestService.Event(request.type(), request.visitorId(), request.sessionId(),
                request.path(), request.referrerHost(), request.utmSource(), request.utmMedium(),
                request.utmCampaign(), request.engagedSeconds(), request.consentVersion()));
        return ResponseEntity.noContent().header("Cache-Control", "no-store").build();
    }
}
