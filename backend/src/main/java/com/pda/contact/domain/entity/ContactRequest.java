package com.pda.contact.domain.entity;

import com.pda.contact.domain.enums.DeliveryStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * The fact that a contact-form message was (or failed to be) delivered, and when. Deliberately nothing else: no name,
 * address or message text is kept; the message only travels to the PDA inbox by mail.
 */
@Entity
@Table(name = "contact_requests")
public class ContactRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", nullable = false, updatable = false, length = 16)
    private DeliveryStatus deliveryStatus;

    protected ContactRequest() {
    }

    public static ContactRequest of(DeliveryStatus status, Instant createdAt) {
        ContactRequest request = new ContactRequest();
        request.deliveryStatus = Objects.requireNonNull(status, "status is required");
        request.createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        return request;
    }

    public UUID getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }
    public DeliveryStatus getDeliveryStatus() { return deliveryStatus; }
}
