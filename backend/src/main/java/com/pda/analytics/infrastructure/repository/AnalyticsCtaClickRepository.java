package com.pda.analytics.infrastructure.repository;

import com.pda.analytics.domain.entity.AnalyticsCtaClick;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalyticsCtaClickRepository extends JpaRepository<AnalyticsCtaClick, UUID> {

    long countBySessionId(UUID sessionId);
}
