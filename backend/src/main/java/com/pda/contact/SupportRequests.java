package com.pda.contact;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Public Contact module contract for the platform administration: the support messages that were stored when the contact
 * form was submitted. The views carry exactly the stored fields (name, e-mail address and message are personal data the
 * visitor typed), so callers must authorize the platform administrator themselves and must not log or forward them.
 */
public interface SupportRequests {

    /** Newest first. Both filters are optional. */
    SupportPage list(SupportStatus status, SupportCategory category, int page, int size);

    Optional<SupportDetail> find(UUID id);

    /** Sets the handling status; {@code UNCHANGED} when it already has that value. */
    StatusChange changeStatus(UUID id, SupportStatus status);

    enum StatusChange { CHANGED, UNCHANGED, NOT_FOUND }

    /** {@code messagePreview} is the first 120 characters of the message on one line. {@code deliveryStatus} is SENT or FAILED. */
    record SupportSummary(UUID id, Instant createdAt, SupportCategory category, String firstName, String lastName,
                          String email, SupportStatus status, Instant statusChangedAt, String deliveryStatus,
                          String messagePreview) {}

    record SupportDetail(UUID id, Instant createdAt, SupportCategory category, String firstName, String lastName,
                         String email, String message, SupportStatus status, Instant statusChangedAt,
                         String deliveryStatus) {}

    record SupportPage(List<SupportSummary> items, int page, int size, long totalElements) {}
}
