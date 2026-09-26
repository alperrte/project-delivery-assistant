package com.pda.user.domain.entity;

import com.pda.user.OAuthProvider;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Links a PDA user to one account at an external provider, identified by the provider's stable subject id. */
@Entity
@Table(name = "user_oauth_identities")
public class UserOAuthIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OAuthProvider provider;

    @Column(name = "provider_subject", nullable = false, length = 255)
    private String providerSubject;

    @Column(name = "provider_email", length = 320)
    private String providerEmail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected UserOAuthIdentity() {
        // JPA
    }

    public static UserOAuthIdentity link(UUID userId, OAuthProvider provider, String providerSubject,
                                         String providerEmail) {
        Objects.requireNonNull(userId, "userId");
        Objects.requireNonNull(provider, "provider");
        if (providerSubject == null || providerSubject.isBlank() || providerSubject.length() > 255) {
            throw new IllegalArgumentException("Invalid provider subject");
        }
        UserOAuthIdentity identity = new UserOAuthIdentity();
        identity.userId = userId;
        identity.provider = provider;
        identity.providerSubject = providerSubject;
        identity.providerEmail = providerEmail == null || providerEmail.length() > 320 ? null : providerEmail;
        return identity;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public OAuthProvider getProvider() { return provider; }
    public String getProviderSubject() { return providerSubject; }
    public String getProviderEmail() { return providerEmail; }
    public Instant getCreatedAt() { return createdAt; }
}
