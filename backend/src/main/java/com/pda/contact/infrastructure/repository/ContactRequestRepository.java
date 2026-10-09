package com.pda.contact.infrastructure.repository;

import com.pda.contact.domain.entity.ContactRequest;
import com.pda.contact.domain.enums.DeliveryStatus;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContactRequestRepository extends JpaRepository<ContactRequest, UUID> {

    long countByDeliveryStatus(DeliveryStatus status);

    long countByDeliveryStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(DeliveryStatus status, Instant from,
                                                                                Instant toExclusive);
}
