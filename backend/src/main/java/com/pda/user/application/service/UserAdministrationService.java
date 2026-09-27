package com.pda.user.application.service;

import com.pda.user.GlobalRole;
import com.pda.user.UserAdministration;
import com.pda.user.domain.entity.User;
import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.infrastructure.repository.UserOAuthIdentityRepository;
import com.pda.user.infrastructure.repository.UserRepository;
import com.pda.user.infrastructure.repository.UserSessionRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAdministrationService implements UserAdministration {

    private static final Logger log = LoggerFactory.getLogger(UserAdministrationService.class);

    private final UserRepository users;
    private final UserOAuthIdentityRepository identities;
    private final UserSessionRepository sessions;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserAdministrationService(UserRepository users, UserOAuthIdentityRepository identities,
                                     UserSessionRepository sessions, BCryptPasswordEncoder passwordEncoder) {
        this.users = users;
        this.identities = identities;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public BootstrapOutcome bootstrapAdmin(String email, String rawPassword) {
        if (users.existsByGlobalRole(GlobalRole.ADMIN)) {
            return BootstrapOutcome.ADMIN_EXISTS;
        }
        if (users.existsByEmailIgnoreCase(email)) {
            return BootstrapOutcome.EMAIL_TAKEN;
        }
        try {
            users.saveAndFlush(User.bootstrapAdmin(email, availableNickname(), rawPassword, passwordEncoder));
            return BootstrapOutcome.CREATED;
        } catch (DataIntegrityViolationException exception) {
            // Another instance won the race for the same email/nickname; never overwrite its account.
            return BootstrapOutcome.ADMIN_EXISTS;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public UserPage list(int page, int size) {
        var result = users.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")
                .and(Sort.by("id"))));
        return new UserPage(result.getContent().stream().map(UserAdministrationService::summary).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserDetail> find(UUID userId, Instant now) {
        return users.findById(userId).map(user -> new UserDetail(summary(user),
                identities.findByUserIdOrderByCreatedAtAsc(userId).stream().map(identity -> identity.getProvider())
                        .toList(),
                sessions.countByUserIdAndRevokedAtIsNullAndExpiresAtAfter(userId, now)));
    }

    @Override
    @Transactional
    public StatusOutcome disable(UUID actorId, UUID targetId, Instant now) {
        if (targetId.equals(actorId)) {
            return StatusOutcome.SELF_DENIED;
        }
        // Lock first so two administrators cannot disable each other concurrently and leave none.
        var activeAdmins = users.lockActiveAdmins();
        Optional<User> found = users.findById(targetId);
        if (found.isEmpty()) {
            return StatusOutcome.NOT_FOUND;
        }
        User target = found.get();
        if (target.getAccountStatus() == AccountStatus.DISABLED) {
            return StatusOutcome.UNCHANGED;
        }
        if (target.getGlobalRole() == GlobalRole.ADMIN && activeAdmins.size() <= 1) {
            return StatusOutcome.LAST_ADMIN;
        }
        target.disable();
        sessions.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(targetId, now)
                .forEach(session -> session.revoke(now));
        log.info("Account disabled by administrator. actorId={} targetId={}", actorId, targetId);
        return StatusOutcome.CHANGED;
    }

    @Override
    @Transactional
    public StatusOutcome enable(UUID targetId) {
        Optional<User> found = users.findById(targetId);
        if (found.isEmpty()) {
            return StatusOutcome.NOT_FOUND;
        }
        if (found.get().getAccountStatus() != AccountStatus.DISABLED) {
            return StatusOutcome.UNCHANGED;
        }
        found.get().enable();
        return StatusOutcome.CHANGED;
    }

    @Override
    @Transactional(readOnly = true)
    public UserCounts counts() {
        return new UserCounts(users.count(), users.countByAccountStatus(AccountStatus.ACTIVE),
                users.countByAccountStatus(AccountStatus.DISABLED),
                users.countByAccountStatus(AccountStatus.PENDING_VERIFICATION),
                users.countByGlobalRole(GlobalRole.ADMIN));
    }

    private String availableNickname() {
        return users.existsByNickname("admin")
                ? "admin_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) : "admin";
    }

    private static UserSummary summary(User user) {
        return new UserSummary(user.getId(), user.getEmail(), user.getNickname(), user.getAccountStatus().name(),
                user.getEmailVerificationStatus().name(), user.getGlobalRole().name(), user.isMustChangePassword(),
                user.getCreatedAt());
    }
}
