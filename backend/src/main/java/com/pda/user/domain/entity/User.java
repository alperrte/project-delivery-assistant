package com.pda.user.domain.entity;

import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.domain.enums.EmailVerificationStatus;
import com.pda.user.domain.enums.GlobalRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(name = "uk_users_email", columnNames = "email"),
        @UniqueConstraint(name = "uk_users_nickname", columnNames = "nickname")
})
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank
    @Email
    @Size(max = 320)
    @Column(nullable = false, length = 320)
    private String email;

    @NotBlank
    @Pattern(regexp = "[\\p{L}\\p{N}_]{3,32}")
    @Column(nullable = false, length = 32)
    private String nickname;

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_status", nullable = false, length = 32)
    private AccountStatus accountStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "email_verification_status", nullable = false, length = 32)
    private EmailVerificationStatus emailVerificationStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "global_role", nullable = false, length = 16)
    private GlobalRole globalRole;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected User() {
        // JPA
    }

    public static User registerLocal(String email, String nickname, String rawPassword,
                                     BCryptPasswordEncoder passwordEncoder) {
        Objects.requireNonNull(passwordEncoder, "passwordEncoder");
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }
        User user = new User();
        user.email = email;
        user.nickname = nickname;
        user.passwordHash = passwordEncoder.encode(rawPassword);
        user.accountStatus = AccountStatus.PENDING_VERIFICATION;
        user.emailVerificationStatus = EmailVerificationStatus.PENDING;
        user.globalRole = GlobalRole.USER;
        return user;
    }

    public static User registerLocalActive(String email, String nickname, String rawPassword,
                                           BCryptPasswordEncoder passwordEncoder) {
        User user = registerLocal(email, nickname, rawPassword, passwordEncoder);
        user.accountStatus = AccountStatus.ACTIVE;
        return user;
    }

    /** Account created through an external provider that already verified the email; it has no password. */
    public static User registerOAuth(String email, String nickname) {
        User user = new User();
        user.email = email;
        user.nickname = nickname;
        user.accountStatus = AccountStatus.ACTIVE;
        user.emailVerificationStatus = EmailVerificationStatus.VERIFIED;
        user.emailVerifiedAt = Instant.now();
        user.globalRole = GlobalRole.USER;
        return user;
    }

    public boolean hasPassword() {
        return passwordHash != null;
    }

    public boolean matchesPassword(String rawPassword, BCryptPasswordEncoder passwordEncoder) {
        return passwordHash != null && rawPassword != null
                && passwordEncoder.matches(rawPassword, passwordHash);
    }

    public void verifyEmail() {
        emailVerificationStatus = EmailVerificationStatus.VERIFIED;
        emailVerifiedAt = Instant.now();
        if (accountStatus == AccountStatus.PENDING_VERIFICATION) {
            accountStatus = AccountStatus.ACTIVE;
        }
    }

    public void disable() {
        accountStatus = AccountStatus.DISABLED;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getNickname() { return nickname; }
    public AccountStatus getAccountStatus() { return accountStatus; }
    public EmailVerificationStatus getEmailVerificationStatus() { return emailVerificationStatus; }
    public GlobalRole getGlobalRole() { return globalRole; }
    public Instant getEmailVerifiedAt() { return emailVerifiedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
