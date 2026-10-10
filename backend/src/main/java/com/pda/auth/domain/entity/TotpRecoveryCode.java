package com.pda.auth.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** A single-use backup code; only its HMAC is stored. */
@Entity
@Table(name = "totp_recovery_codes")
public class TotpRecoveryCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "code_hash", nullable = false, updatable = false, length = 64)
    private String codeHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "used_at")
    private Instant usedAt;

    protected TotpRecoveryCode() {
        // JPA
    }

    public static TotpRecoveryCode issue(UUID userId, String codeHash, Instant now) {
        TotpRecoveryCode code = new TotpRecoveryCode();
        code.userId = Objects.requireNonNull(userId, "userId");
        code.codeHash = Objects.requireNonNull(codeHash, "codeHash");
        code.createdAt = Objects.requireNonNull(now, "now");
        return code;
    }

    public void use(Instant now) {
        if (usedAt != null) {
            throw new IllegalStateException("Backup code was already used");
        }
        usedAt = now;
    }

    public UUID getUserId() { return userId; }
    public Instant getUsedAt() { return usedAt; }
}
