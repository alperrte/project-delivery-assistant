package com.pda.contact.application.service;

import com.pda.contact.SupportCategory;
import com.pda.contact.SupportRequests;
import com.pda.contact.SupportStatus;
import com.pda.contact.domain.entity.SupportRequest;
import com.pda.contact.infrastructure.repository.SupportRequestRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupportRequestService implements SupportRequests {

    static final int PREVIEW_LENGTH = 120;

    private final SupportRequestRepository requests;
    private final Clock clock;

    public SupportRequestService(SupportRequestRepository requests, Clock clock) {
        this.requests = requests;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public SupportPage list(SupportStatus status, SupportCategory category, int page, int size) {
        Specification<SupportRequest> filter = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            if (category != null) {
                predicates.add(builder.equal(root.get("category"), category));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        var result = requests.findAll(filter, PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"))));
        return new SupportPage(result.getContent().stream().map(SupportRequestService::summary).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SupportDetail> find(UUID id) {
        return requests.findById(id).map(SupportRequestService::detail);
    }

    @Override
    @Transactional
    public StatusChange changeStatus(UUID id, SupportStatus status) {
        return requests.findById(id)
                .map(request -> request.changeStatus(status, clock.instant()) ? StatusChange.CHANGED
                        : StatusChange.UNCHANGED)
                .orElse(StatusChange.NOT_FOUND);
    }

    private static SupportSummary summary(SupportRequest request) {
        return new SupportSummary(request.getId(), request.getCreatedAt(), request.getCategory(),
                request.getFirstName(), request.getLastName(), request.getEmail(), request.getStatus(),
                request.getStatusChangedAt(), request.getDeliveryStatus().name(), preview(request.getMessage()));
    }

    private static SupportDetail detail(SupportRequest request) {
        return new SupportDetail(request.getId(), request.getCreatedAt(), request.getCategory(),
                request.getFirstName(), request.getLastName(), request.getEmail(), request.getMessage(),
                request.getStatus(), request.getStatusChangedAt(), request.getDeliveryStatus().name());
    }

    /** The first characters on one line, cut on a code point boundary. */
    static String preview(String message) {
        String line = message.replaceAll("\\s+", " ").strip();
        if (line.codePointCount(0, line.length()) <= PREVIEW_LENGTH) {
            return line;
        }
        return line.substring(0, line.offsetByCodePoints(0, PREVIEW_LENGTH)) + "…";
    }
}
