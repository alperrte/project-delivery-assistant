package com.pda.user.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.BackendApplication;
import com.pda.user.UserAccounts;
import com.pda.user.domain.entity.User;
import com.pda.user.domain.entity.UserSession;
import com.pda.user.infrastructure.repository.UserRepository;
import com.pda.user.infrastructure.repository.UserSessionRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest(classes = BackendApplication.class)
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class UserPersistenceTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new java.security.SecureRandom().nextBytes(JWT_KEY); }

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> java.util.Base64.getEncoder().encodeToString(JWT_KEY));
    }

    @Autowired UserRepository users;
    @Autowired UserSessionRepository sessions;
    @Autowired UserAccounts accounts;
    @Autowired JdbcTemplate jdbc;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Test
    void userIsPersistedWithHashAndCaseInsensitiveEmailIsUnique() {
        User upper = users.saveAndFlush(User.registerLocal("Alper@example.test", "Alper", "sample-password", passwordEncoder));

        String persistedHash = jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, upper.getId());
        assertNotEquals("sample-password", persistedHash);
        assertTrue(passwordEncoder.matches("sample-password", persistedHash));
        assertTrue(users.existsByEmail("Alper@example.test"));
        assertFalse(users.existsByEmail("alper@example.test"));
        assertTrue(upper.getCreatedAt() != null && upper.getUpdatedAt() != null);

        // V33 (uk_users_email_ci): the same address in another letter case is a duplicate account.
        assertThrows(DataIntegrityViolationException.class, () -> users.saveAndFlush(
                User.registerLocal("alper@example.test", "alper", "other-password", passwordEncoder)));
    }

    @Test
    void duplicateEmailIsRejectedByDatabase() {
        users.saveAndFlush(User.registerLocal("duplicate@example.test", "first_name", "sample-password", passwordEncoder));
        assertThrows(DataIntegrityViolationException.class, () -> users.saveAndFlush(
                User.registerLocal("duplicate@example.test", "second_name", "sample-password", passwordEncoder)));
    }

    @Test
    void duplicateNicknameIsRejectedByDatabase() {
        users.saveAndFlush(User.registerLocal("first@example.test", "same_name", "sample-password", passwordEncoder));
        assertThrows(DataIntegrityViolationException.class, () -> users.saveAndFlush(
                User.registerLocal("second@example.test", "same_name", "sample-password", passwordEncoder)));
    }

    @Test
    void sessionStoresOnlyHashAndActiveQueryExcludesRevokedOrExpired() {
        User user = users.saveAndFlush(User.registerLocal("session@example.test", "session_user", "sample-password", passwordEncoder));
        Instant now = Instant.now();
        UserSession active = sessions.saveAndFlush(UserSession.open(user.getId(), "refresh-token-one", now.plus(7, ChronoUnit.DAYS)));
        UserSession expired = sessions.saveAndFlush(UserSession.open(user.getId(), "refresh-token-two", now.minus(1, ChronoUnit.DAYS)));
        UserSession revoked = sessions.saveAndFlush(UserSession.open(user.getId(), "refresh-token-three", now.plus(7, ChronoUnit.DAYS)));
        revoked.revoke(now);
        sessions.saveAndFlush(revoked);

        String persistedHash = jdbc.queryForObject("SELECT refresh_token_hash FROM user_sessions WHERE id = ?", String.class, active.getId());
        assertNotEquals("refresh-token-one", persistedHash);
        assertTrue(persistedHash.matches("[0-9a-f]{64}"));
        assertTrue(active.matchesRefreshToken("refresh-token-one"));
        assertEquals(1, sessions.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(user.getId(), now).size());
        assertTrue(sessions.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(UUID.randomUUID(), now).isEmpty());
        assertTrue(expired.getCreatedAt() != null);
    }

    @Test
    void oauthOnlyAccountCanHaveNoPasswordHashInSchema() {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        jdbc.update("""
                INSERT INTO users (id, email, nickname, password_hash, account_status,
                                   email_verification_status, global_role, email_verified_at, created_at, updated_at)
                VALUES (?, ?, ?, NULL, 'ACTIVE', 'VERIFIED', 'USER', ?, ?, ?)
                """, id, "oauth@example.test", "oauth_user", Timestamp.from(now), Timestamp.from(now), Timestamp.from(now));

        User user = users.findById(id).orElseThrow();
        assertFalse(user.matchesPassword("any-password", passwordEncoder));
    }

    @Test
    void searchActiveUsersMatchesNicknameSubstringOrExactEmailAndHidesInactive() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        User active = users.saveAndFlush(User.registerLocalActive(
                "searchable_" + suffix + "@example.test", "search_target_" + suffix, "sample-password", passwordEncoder));
        users.saveAndFlush(User.registerLocal(
                "pending_" + suffix + "@example.test", "search_pending_" + suffix, "sample-password", passwordEncoder));

        List<UserAccounts.UserSearchResult> byNickname = accounts.searchActiveUsers("search_target_" + suffix, 20);
        assertEquals(1, byNickname.size());
        assertEquals(active.getId(), byNickname.get(0).userId());

        List<UserAccounts.UserSearchResult> byUpperCaseNickname =
                accounts.searchActiveUsers(("SEARCH_TARGET_" + suffix).toUpperCase(), 20);
        assertEquals(1, byUpperCaseNickname.size());

        assertEquals(1, accounts.searchActiveUsers("searchable_" + suffix + "@example.test", 20).size());
        assertTrue(accounts.searchActiveUsers("search_pending_" + suffix, 20).isEmpty());
        assertTrue(accounts.searchActiveUsers("a", 20).isEmpty());
        assertTrue(accounts.searchActiveUsers(null, 20).isEmpty());
    }
}
