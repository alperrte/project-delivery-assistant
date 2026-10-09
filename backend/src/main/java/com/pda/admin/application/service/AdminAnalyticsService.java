package com.pda.admin.application.service;

import com.pda.analytics.AnalyticsReporting;
import com.pda.contact.ContactReporting;
import com.pda.user.UserAdministration;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Composes the administration dashboard from the public contracts of three modules. Traffic comes only from consented,
 * anonymous analytics; registrations, account counts and contact messages come from their own authoritative
 * records, so they never depend on anybody's analytics choice.
 */
@Service
public class AdminAnalyticsService {

    static final int MAX_RANGE_DAYS = 366;
    static final int DEFAULT_RANGE_DAYS = 30;

    private final AnalyticsReporting analytics;
    private final UserAdministration users;
    private final ContactReporting contact;
    private final Clock clock;

    public AdminAnalyticsService(AnalyticsReporting analytics, UserAdministration users, ContactReporting contact,
                                 Clock clock) {
        this.analytics = analytics;
        this.users = users;
        this.contact = contact;
        this.clock = clock;
    }

    public record Range(LocalDate from, LocalDate to, String zone, int days) {}

    public record Day(LocalDate date, long value) {}

    public record TrafficDay(LocalDate date, long visits, long sessions) {}

    public record Traffic(long visits, long uniqueSessions, long uniqueVisitors, long averageEngagedSeconds,
                          List<TrafficDay> daily, List<AnalyticsReporting.SourceCount> sources,
                          List<AnalyticsReporting.NamedCount> topReferrers,
                          List<AnalyticsReporting.CampaignCount> topCampaigns) {}

    public record Registrations(long inRange, List<Day> daily) {}

    /** {@code terminated} is the count of DISABLED accounts. */
    public record Accounts(long total, long active, long terminated, long pendingVerification, long admins) {}

    public record ContactRequests(long inRange, long total, List<Day> daily) {}

    public record Dashboard(Range range, Traffic traffic, Registrations registrations, Accounts accounts,
                            ContactRequests contactRequests) {}

    /**
     * @param from first day (inclusive) in {@code zoneId}; defaults to 29 days before {@code to}
     * @param to   last day (inclusive); defaults to today in {@code zoneId}
     * @throws IllegalArgumentException for an unknown zone, an inverted range or more than 366 days
     */
    public Dashboard dashboard(LocalDate from, LocalDate to, String zoneId) {
        ZoneId zone = zone(zoneId);
        LocalDate last = to != null ? to : LocalDate.now(clock.withZone(zone));
        LocalDate first = from != null ? from : last.minusDays(DEFAULT_RANGE_DAYS - 1L);
        if (first.isAfter(last)) {
            throw new IllegalArgumentException("from must not be after to");
        }
        int days = (int) ChronoUnit.DAYS.between(first, last) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new IllegalArgumentException("The range is limited to " + MAX_RANGE_DAYS + " days");
        }
        Instant start = first.atStartOfDay(zone).toInstant();
        Instant end = last.plusDays(1).atStartOfDay(zone).toInstant();

        var traffic = analytics.traffic(start, end, zone);
        var registrations = users.registrations(start, end, zone);
        var counts = users.counts();
        var messages = contact.report(start, end, zone);

        Map<LocalDate, AnalyticsReporting.DailyTraffic> trafficByDay = traffic.daily().stream()
                .collect(Collectors.toMap(AnalyticsReporting.DailyTraffic::date, Function.identity()));
        Map<LocalDate, Long> registeredByDay = registrations.daily().stream()
                .collect(Collectors.toMap(UserAdministration.DailyCount::date, UserAdministration.DailyCount::count));
        Map<LocalDate, Long> messagesByDay = messages.daily().stream()
                .collect(Collectors.toMap(ContactReporting.DailyCount::date, ContactReporting.DailyCount::count));

        List<TrafficDay> trafficDays = new ArrayList<>(days);
        List<Day> registrationDays = new ArrayList<>(days);
        List<Day> contactDays = new ArrayList<>(days);
        for (LocalDate day = first; !day.isAfter(last); day = day.plusDays(1)) {
            var traffic0 = trafficByDay.get(day);
            trafficDays.add(new TrafficDay(day, traffic0 == null ? 0 : traffic0.visits(),
                    traffic0 == null ? 0 : traffic0.sessions()));
            registrationDays.add(new Day(day, registeredByDay.getOrDefault(day, 0L)));
            contactDays.add(new Day(day, messagesByDay.getOrDefault(day, 0L)));
        }
        return new Dashboard(new Range(first, last, zone.getId(), days),
                new Traffic(traffic.visits(), traffic.uniqueSessions(), traffic.uniqueVisitors(),
                        traffic.averageEngagedSeconds(), trafficDays, traffic.sources(), traffic.topReferrers(),
                        traffic.topCampaigns()),
                new Registrations(registrations.inRange(), registrationDays),
                new Accounts(counts.total(), counts.active(), counts.disabled(), counts.pendingVerification(),
                        counts.admins()),
                new ContactRequests(messages.sentInRange(), messages.sentTotal(), contactDays));
    }

    private static ZoneId zone(String id) {
        if (id == null || id.isBlank()) {
            return ZoneId.of("UTC");
        }
        String name = id.strip();
        // Region ids only ("Europe/Istanbul", "UTC"): no offsets, no "SystemV" legacy ids, bounded length.
        if (name.length() > 64 || name.startsWith("SystemV") || !ZoneId.getAvailableZoneIds().contains(name)) {
            throw new IllegalArgumentException("Unknown time zone");
        }
        try {
            return ZoneId.of(name);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("Unknown time zone", exception);
        }
    }
}
