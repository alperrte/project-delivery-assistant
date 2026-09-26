package com.pda.user.application.service;

import com.pda.user.OAuthProvider;
import com.pda.user.UserAccounts;
import com.pda.user.UserRegistrationConflictException;
import com.pda.user.domain.entity.User;
import com.pda.user.domain.entity.UserOAuthIdentity;
import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.infrastructure.repository.UserOAuthIdentityRepository;
import com.pda.user.infrastructure.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAccountService implements UserAccounts {

    private final UserRepository users;
    private final UserOAuthIdentityRepository identities;
    private final BCryptPasswordEncoder passwordEncoder;
    private final String dummyHash;

    public UserAccountService(UserRepository users, UserOAuthIdentityRepository identities,
                              BCryptPasswordEncoder passwordEncoder) {
        this.users = users;
        this.identities = identities;
        this.passwordEncoder = passwordEncoder;
        this.dummyHash = passwordEncoder.encode(java.util.UUID.randomUUID().toString());
    }

    @Override
    @Transactional
    public UUID registerLocal(String email, String nickname, String rawPassword) {
        if (users.existsByEmail(email) || users.existsByNickname(nickname)) {
            throw new UserRegistrationConflictException();
        }
        try {
            return users.saveAndFlush(User.registerLocalActive(email, nickname, rawPassword, passwordEncoder)).getId();
        } catch (DataIntegrityViolationException exception) {
            throw new UserRegistrationConflictException();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UUID> findPendingByEmail(String email) {
        return users.findByEmail(email)
                .filter(user -> user.getAccountStatus() == AccountStatus.PENDING_VERIFICATION)
                .map(User::getId);
    }

    @Override
    @Transactional
    public boolean activateVerifiedEmail(UUID userId) {
        Optional<User> candidate = users.findById(userId);
        if (candidate.isEmpty() || candidate.get().getAccountStatus() != AccountStatus.PENDING_VERIFICATION) {
            return false;
        }
        candidate.get().verifyEmail();
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AuthenticatedUser> authenticateLocal(String email, String password) {
        Optional<User> found = users.findByEmail(email);
        if (found.isEmpty()) {
            passwordEncoder.matches(password, dummyHash);
            return Optional.empty();
        }
        User user = found.get();
        boolean matches = user.matchesPassword(password, passwordEncoder);
        return matches && user.getAccountStatus() == AccountStatus.ACTIVE
                ? Optional.of(summary(user)) : Optional.empty();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AuthenticatedUser> findActiveById(UUID userId) {
        return users.findById(userId)
                .filter(user -> user.getAccountStatus() == AccountStatus.ACTIVE)
                .map(UserAccountService::summary);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AuthenticatedUser> findActiveByOAuthIdentity(OAuthProvider provider, String subject) {
        return identities.findByProviderAndProviderSubject(provider, subject)
                .flatMap(identity -> users.findById(identity.getUserId()))
                .filter(user -> user.getAccountStatus() == AccountStatus.ACTIVE)
                .map(UserAccountService::summary);
    }

    @Override
    @Transactional
    public UUID registerOAuth(OAuthProvider provider, String subject, String email, String displayName) {
        if (users.existsByEmailIgnoreCase(email)
                || identities.findByProviderAndProviderSubject(provider, subject).isPresent()) {
            throw new UserRegistrationConflictException();
        }
        try {
            UUID id = users.saveAndFlush(User.registerOAuth(email, availableNickname(displayName, email))).getId();
            identities.saveAndFlush(UserOAuthIdentity.link(id, provider, subject, email));
            return id;
        } catch (DataIntegrityViolationException exception) {
            throw new UserRegistrationConflictException();
        }
    }

    @Override
    @Transactional
    public LinkOutcome linkOAuth(UUID userId, OAuthProvider provider, String subject, String providerEmail) {
        Optional<User> user = users.findById(userId).filter(found -> found.getAccountStatus() == AccountStatus.ACTIVE);
        if (user.isEmpty()) {
            return LinkOutcome.ACCOUNT_UNAVAILABLE;
        }
        Optional<UserOAuthIdentity> existing = identities.findByProviderAndProviderSubject(provider, subject);
        if (existing.isPresent()) {
            return existing.get().getUserId().equals(userId)
                    ? LinkOutcome.ALREADY_LINKED : LinkOutcome.IDENTITY_USED_BY_OTHER_ACCOUNT;
        }
        if (identities.findByUserIdAndProvider(userId, provider).isPresent()) {
            return LinkOutcome.PROVIDER_HAS_OTHER_IDENTITY;
        }
        try {
            identities.saveAndFlush(UserOAuthIdentity.link(userId, provider, subject, providerEmail));
            return LinkOutcome.LINKED;
        } catch (DataIntegrityViolationException exception) {
            return LinkOutcome.IDENTITY_USED_BY_OTHER_ACCOUNT;
        }
    }

    @Override
    @Transactional
    public UnlinkOutcome unlinkOAuth(UUID userId, OAuthProvider provider) {
        Optional<UserOAuthIdentity> identity = identities.findByUserIdAndProvider(userId, provider);
        if (identity.isEmpty()) {
            return UnlinkOutcome.NOT_LINKED;
        }
        boolean hasPassword = users.findById(userId).map(User::hasPassword).orElse(false);
        if (!hasPassword && identities.countByUserId(userId) <= 1) {
            return UnlinkOutcome.LAST_LOGIN_METHOD;
        }
        identities.delete(identity.get());
        return UnlinkOutcome.UNLINKED;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LinkedOAuthIdentity> listOAuthIdentities(UUID userId) {
        return identities.findByUserIdOrderByCreatedAtAsc(userId).stream()
                .map(identity -> new LinkedOAuthIdentity(identity.getProvider(), identity.getProviderEmail(),
                        identity.getCreatedAt()))
                .toList();
    }

    /** Derives a valid, unused nickname from the provider display name (or email) without trusting its shape. */
    private String availableNickname(String displayName, String email) {
        String source = displayName != null && !displayName.isBlank() ? displayName : email.split("@", 2)[0];
        String base = source.replaceAll("[^\\p{L}\\p{N}_]+", "_").replaceAll("^_+|_+$", "");
        if (base.length() > 24) {
            base = base.substring(0, 24);
        }
        if (base.length() < 3) {
            base = "user";
        }
        String candidate = base;
        for (int attempt = 0; attempt < 10 && users.existsByNickname(candidate); attempt++) {
            candidate = base + "_" + java.util.concurrent.ThreadLocalRandom.current().nextInt(1000, 10000);
        }
        return users.existsByNickname(candidate)
                ? "user_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) : candidate;
    }

    private static AuthenticatedUser summary(User user) {
        return new AuthenticatedUser(user.getId(), user.getEmail(), user.getNickname(), user.getGlobalRole().name());
    }
}
