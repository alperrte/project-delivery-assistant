package com.pda.user.application.service;

import com.pda.user.GlobalRole;
import com.pda.user.UserAdministration;
import com.pda.user.domain.entity.User;
import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.infrastructure.repository.UserOAuthIdentityRepository;
import com.pda.user.infrastructure.repository.UserRepository;
import com.pda.user.infrastructure.repository.UserSessionRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.simple.JdbcClient;
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
    private final JdbcClient jdbc;

    public UserAdministrationService(UserRepository users, UserOAuthIdentityRepository identities,
                                     UserSessionRepository sessions, BCryptPasswordEncoder passwordEncoder,
                                     JdbcClient jdbc) {
        this.users = users;
        this.identities = identities;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
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
    public UserPage list(int page, int size, String search, String status) {
        var result = users.findAll(filter(search, status), PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"))));
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
    public StatusOutcome enable(UUID actorId, UUID targetId) {
        Optional<User> found = users.findById(targetId);
        if (found.isEmpty()) {
            return StatusOutcome.NOT_FOUND;
        }
        if (found.get().getAccountStatus() != AccountStatus.DISABLED) {
            return StatusOutcome.UNCHANGED;
        }
        found.get().enable();
        log.info("Account enabled by administrator. actorId={} targetId={}", actorId, targetId);
        return StatusOutcome.CHANGED;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> nicknames(Set<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> result = new HashMap<>();
        users.findAllById(userIds).stream()
                .filter(user -> user.getAccountStatus() != AccountStatus.DELETED)
                .forEach(user -> result.put(user.getId(), user.getNickname()));
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public UserCounts counts() {
        return new UserCounts(users.count(), users.countByAccountStatus(AccountStatus.ACTIVE),
                users.countByAccountStatus(AccountStatus.DISABLED),
                users.countByAccountStatus(AccountStatus.PENDING_VERIFICATION),
                users.countByGlobalRole(GlobalRole.ADMIN));
    }

    @Override
    @Transactional(readOnly = true)
    public RegistrationReport registrations(Instant from, Instant toExclusive, ZoneId zone) {
        OffsetDateTime start = from.atOffset(ZoneOffset.UTC);
        OffsetDateTime end = toExclusive.atOffset(ZoneOffset.UTC);
        List<DailyCount> daily = jdbc.sql("""
                SELECT (created_at AT TIME ZONE :zone)::date AS day, count(*) AS total
                FROM users WHERE created_at >= :from AND created_at < :to
                GROUP BY 1 ORDER BY 1
                """).param("zone", zone.getId()).param("from", start).param("to", end)
                .query((rs, row) -> new DailyCount(rs.getDate("day").toLocalDate(), rs.getLong("total"))).list();
        long inRange = daily.stream().mapToLong(DailyCount::count).sum();
        return new RegistrationReport(inRange, daily);
    }

    /**
     * Server-side filter: an optional status and a literal (wildcards escaped) substring of email or nickname. DELETED
     * (anonymised accounts) is not a listable status: like an unknown value it is an {@link IllegalArgumentException},
     * which the API answers with the same 400 problem body.
     */
    private static Specification<User> filter(String search, String status) {
        AccountStatus wanted = status == null || status.isBlank() ? null : AccountStatus.valueOf(status.strip());
        if (wanted == AccountStatus.DELETED) {
            throw new IllegalArgumentException("Unsupported status filter");
        }
        String term = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (wanted != null) {
                predicates.add(builder.equal(root.get("accountStatus"), wanted));
            }
            if (!term.isEmpty()) {
                String pattern = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                predicates.add(builder.or(builder.like(builder.lower(root.get("email")), pattern, '\\'),
                        builder.like(builder.lower(root.get("nickname")), pattern, '\\')));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
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
