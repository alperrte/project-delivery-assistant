package com.pda.contact;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Public Contact module contract for the platform administration dashboard: how many contact-form messages were
 * delivered. Only SENT submissions count; failed deliveries are excluded and no message content, name or address
 * exists to be returned. Callers must authorize the platform administrator themselves.
 */
public interface ContactReporting {

    /** Delivered submissions inside {@code [from, toExclusive)}; days are cut in {@code zone} and absent when empty. */
    ContactReport report(Instant from, Instant toExclusive, ZoneId zone);

    record ContactReport(long sentInRange, long sentTotal, List<DailyCount> daily) {}

    record DailyCount(LocalDate date, long count) {}
}
