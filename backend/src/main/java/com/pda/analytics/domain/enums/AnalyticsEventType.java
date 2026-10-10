package com.pda.analytics.domain.enums;

/** The only event types the public endpoint accepts. Anything else is rejected while the request is read. */
public enum AnalyticsEventType {
    PAGE_VIEW,
    ENGAGEMENT,
    /** A click on one of the allow-listed calls to action ({@link AnalyticsCtaId}). */
    CTA_CLICK,
    /** A client-side failure reported by kind only ({@link AnalyticsErrorKind}); never a message or stack. */
    CLIENT_ERROR
}
