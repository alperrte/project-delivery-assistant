package com.pda.analytics.infrastructure.repository;

import com.pda.analytics.domain.entity.AnalyticsClientError;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalyticsClientErrorRepository extends JpaRepository<AnalyticsClientError, UUID> {

    long countBySessionId(UUID sessionId);
}
