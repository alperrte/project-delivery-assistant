package com.pda.contact.domain.entity;

import com.pda.contact.SupportCategory;
import com.pda.contact.SupportStatus;
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
 * A contact-form message kept for the administrators to handle (12 months, then the retention job removes it). It holds
 * what the visitor typed - this is personal data and is only ever returned by the administrator API.
 */
@Entity
@Table(name = "support_requests")
public class SupportRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 16)
    private SupportCategory category;

    @Column(name = "first_name", nullable = false, updatable = false, length = 80)
    private String firstName;

    @Column(name = "last_name", updatable = false, length = 80)
    private String lastName;

    @Column(nullable = false, updatable = false, length = 254)
    private String email;

    @Column(nullable = false, updatable = false, length = 5000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SupportStatus status;

    @Column(name = "status_changed_at", nullable = false)
    private Instant statusChangedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", nullable = false, updatable = false, length = 16)
    private DeliveryStatus deliveryStatus;

    protected SupportRequest() {
    }

    public static SupportRequest received(SupportCategory category, String firstName, String lastName, String email,
                                          String message, DeliveryStatus deliveryStatus, Instant at) {
        SupportRequest request = new SupportRequest();
        request.category = Objects.requireNonNull(category, "category is required");
        request.firstName = Objects.requireNonNull(firstName, "firstName is required");
        request.lastName = lastName;
        request.email = Objects.requireNonNull(email, "email is required");
        request.message = Objects.requireNonNull(message, "message is required");
        request.deliveryStatus = Objects.requireNonNull(deliveryStatus, "deliveryStatus is required");
        request.createdAt = Objects.requireNonNull(at, "at is required");
        request.status = SupportStatus.NEW;
        request.statusChangedAt = at;
        return request;
    }

    /** False when the request already has that status. */
    public boolean changeStatus(SupportStatus next, Instant at) {
        Objects.requireNonNull(next, "status is required");
        if (status == next) {
            return false;
        }
        status = next;
        statusChangedAt = Objects.requireNonNull(at, "at is required");
        return true;
    }

    public UUID getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }
    public SupportCategory getCategory() { return category; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getEmail() { return email; }
    public String getMessage() { return message; }
    public SupportStatus getStatus() { return status; }
    public Instant getStatusChangedAt() { return statusChangedAt; }
    public DeliveryStatus getDeliveryStatus() { return deliveryStatus; }
}
