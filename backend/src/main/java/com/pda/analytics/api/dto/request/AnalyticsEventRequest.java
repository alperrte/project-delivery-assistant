package com.pda.analytics.api.dto.request;

import com.pda.analytics.domain.enums.AnalyticsEventType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * What the browser may tell the server. Everything is bounded; the type is an allow-list enum, so an unknown type is
 * rejected while the body is read. There is deliberately no user, role, duration-of-session, timestamp or account
 * field: unknown properties in the body are never bound, so they cannot be stored.
 *
 * @param path           the visited route as a template ("/projects/[slug]/tasks"), never a query string or an id
 * @param referrerHost   host of the referring page (first page of a session only), never a full URL
 * @param engagedSeconds active seconds since the previous event (ENGAGEMENT only); the server caps it
 */
public record AnalyticsEventRequest(
        @NotNull AnalyticsEventType type,
        @NotNull UUID visitorId,
        @NotNull UUID sessionId,
        @NotNull @Size(max = 200) @Pattern(regexp = AnalyticsEventRequest.ROUTE) String path,
        @Size(max = 100) String referrerHost,
        @Size(max = 100) String utmSource,
        @Size(max = 100) String utmMedium,
        @Size(max = 100) String utmCampaign,
        @Min(0) @Max(600) Integer engagedSeconds,
        @NotNull @Min(1) @Max(1000) Integer consentVersion
) {
    /** "/" or segments of letters, digits, "_" and "-" or one bracketed parameter name, e.g. "/projects/[slug]". */
    static final String ROUTE = "^/$|^(?:/(?:[A-Za-z0-9_-]+|\\[[A-Za-z0-9_-]+\\]))+$";
}
