package com.pda.contact.application.service;

import com.pda.contact.ContactReporting;
import com.pda.contact.domain.enums.DeliveryStatus;
import com.pda.contact.infrastructure.repository.ContactReportQueries;
import com.pda.contact.infrastructure.repository.ContactRequestRepository;
import java.time.Instant;
import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContactReportingService implements ContactReporting {

    private final ContactRequestRepository requests;
    private final ContactReportQueries queries;

    public ContactReportingService(ContactRequestRepository requests, ContactReportQueries queries) {
        this.requests = requests;
        this.queries = queries;
    }

    @Override
    @Transactional(readOnly = true)
    public ContactReport report(Instant from, Instant toExclusive, ZoneId zone) {
        return new ContactReport(
                requests.countByDeliveryStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                        DeliveryStatus.SENT, from, toExclusive),
                requests.countByDeliveryStatus(DeliveryStatus.SENT),
                queries.dailySent(from, toExclusive, zone));
    }
}
