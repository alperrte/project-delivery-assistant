package com.pda.analytics.domain.enums;

/** The only event types the public endpoint accepts. Anything else is rejected while the request is read. */
public enum AnalyticsEventType {
    PAGE_VIEW,
    ENGAGEMENT
}
