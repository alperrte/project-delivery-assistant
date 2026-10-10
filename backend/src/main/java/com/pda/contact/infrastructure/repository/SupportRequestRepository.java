package com.pda.contact.infrastructure.repository;

import com.pda.contact.domain.entity.SupportRequest;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface SupportRequestRepository
        extends JpaRepository<SupportRequest, UUID>, JpaSpecificationExecutor<SupportRequest> {
}
