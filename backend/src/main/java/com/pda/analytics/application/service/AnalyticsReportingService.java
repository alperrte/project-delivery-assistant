package com.pda.analytics.application.service;

import com.pda.analytics.AnalyticsReporting;
import com.pda.analytics.infrastructure.repository.AnalyticsReportQueries;
import java.time.Instant;
import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsReportingService implements AnalyticsReporting {

    private final AnalyticsReportQueries queries;

    public AnalyticsReportingService(AnalyticsReportQueries queries) {
        this.queries = queries;
    }

    @Override
    @Transactional(readOnly = true)
    public TrafficReport traffic(Instant from, Instant toExclusive, ZoneId zone) {
        return new TrafficReport(queries.visits(from, toExclusive), queries.uniqueSessions(from, toExclusive),
                queries.uniqueVisitors(from, toExclusive), queries.averageEngagedSeconds(from, toExclusive),
                queries.daily(from, toExclusive, zone), queries.sources(from, toExclusive),
                queries.topReferrers(from, toExclusive), queries.topCampaigns(from, toExclusive));
    }
}
