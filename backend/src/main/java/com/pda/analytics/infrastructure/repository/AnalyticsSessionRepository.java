package com.pda.analytics.infrastructure.repository;

import com.pda.analytics.domain.entity.AnalyticsSession;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnalyticsSessionRepository extends JpaRepository<AnalyticsSession, UUID> {

    /** Row lock, so concurrent events of one session are applied one after the other (engagement is capped by elapsed time). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from AnalyticsSession s where s.id = :id")
    Optional<AnalyticsSession> lockById(@Param("id") UUID id);

    /** Creates the session unless it exists already, so two simultaneous first events never collide on the key. */
    @Modifying
    @Query(value = """
            INSERT INTO analytics_sessions (id, visitor_id, started_at, last_seen_at, engaged_seconds, page_views,
                entry_path, source_type, referrer_domain, utm_source, utm_medium, utm_campaign, consent_version)
            VALUES (:id, :visitorId, :now, :now, 0, 0, :entryPath, :sourceType, :referrerDomain, :utmSource,
                :utmMedium, :utmCampaign, :consentVersion)
            ON CONFLICT (id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") UUID id, @Param("visitorId") UUID visitorId, @Param("now") Instant now,
                       @Param("entryPath") String entryPath, @Param("sourceType") String sourceType,
                       @Param("referrerDomain") String referrerDomain, @Param("utmSource") String utmSource,
                       @Param("utmMedium") String utmMedium, @Param("utmCampaign") String utmCampaign,
                       @Param("consentVersion") int consentVersion);
}
