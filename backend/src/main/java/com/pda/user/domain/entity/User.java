package com.pda.user.domain.entity;

import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.domain.enums.EmailVerificationStatus;
import com.pda.user.GlobalRole;
import com.pda.user.NicknameRules;
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
@org.hibernate.annotations.DynamicUpdate
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

    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @NotBlank
    @Pattern(regexp = NicknameRules.REGEX)
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

    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword;

    @Column(name = "profile_photo_updated_at")
    private Instant profilePhotoUpdatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected User() {
        // JPA
    }

    public void profilePhotoStored(Instant at) {
        this.profilePhotoUpdatedAt = Objects.requireNonNull(at, "at is required");
    }

    public void profilePhotoRemoved() {
        this.profilePhotoUpdatedAt = null;
    }

    public void renameNickname(String value) {
        if (!NicknameRules.valid(value)) throw new IllegalArgumentException("Invalid nickname");
        this.nickname = value;
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

    public static User registerInvitedLocal(String email, String nickname, String rawPassword,
                                            String firstName, String lastName,
                                            BCryptPasswordEncoder passwordEncoder) {
        User user = registerLocalActive(email, nickname, rawPassword, passwordEncoder);
        user.firstName = firstName;
        user.lastName = lastName;
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

    /**
     * Platform administrator created from the operator-provided bootstrap credentials. No forced password change: the
     * mandatory authenticator app of the administrator sign-in is the compensating control. The mustChangePassword
     * mechanism itself stays for other flows.
     */
    public static User bootstrapAdmin(String email, String nickname, String rawPassword,
                                      BCryptPasswordEncoder passwordEncoder) {
        User user = registerLocalActive(email, nickname, rawPassword, passwordEncoder);
        user.emailVerificationStatus = EmailVerificationStatus.VERIFIED;
        user.emailVerifiedAt = Instant.now();
        user.globalRole = GlobalRole.ADMIN;
        return user;
    }

    /** Replaces the password hash and ends any pending forced change. */
    public void changePassword(String rawPassword, BCryptPasswordEncoder passwordEncoder) {
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }
        passwordHash = passwordEncoder.encode(rawPassword);
        mustChangePassword = false;
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

    /** Re-enables a disabled account; other statuses are unchanged. */
    public void enable() {
        if (accountStatus == AccountStatus.DISABLED) {
            accountStatus = AccountStatus.ACTIVE;
        }
    }

    /**
     * Wipes everything that identifies the person and ends the account for good. The row stays so that content that
     * points at its id keeps a valid reference; the unique email and nickname get placeholders derived from the id.
     */
    public void anonymise() {
        String suffix = id.toString().replace("-", "");
        email = "deleted-" + suffix + "@deleted.invalid";
        nickname = "deleted_" + suffix.substring(0, 20);
        firstName = null;
        lastName = null;
        passwordHash = null;
        mustChangePassword = false;
        profilePhotoUpdatedAt = null;
        globalRole = GlobalRole.USER;
        accountStatus = AccountStatus.DELETED;
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
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getNickname() { return nickname; }
    public AccountStatus getAccountStatus() { return accountStatus; }
    public EmailVerificationStatus getEmailVerificationStatus() { return emailVerificationStatus; }
    public GlobalRole getGlobalRole() { return globalRole; }
    public Instant getEmailVerifiedAt() { return emailVerifiedAt; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public Instant getProfilePhotoUpdatedAt() { return profilePhotoUpdatedAt; }
}
