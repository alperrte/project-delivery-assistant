package com.pda.analytics.infrastructure.repository;

import com.pda.analytics.domain.entity.AnalyticsPageView;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalyticsPageViewRepository extends JpaRepository<AnalyticsPageView, UUID> {
}
