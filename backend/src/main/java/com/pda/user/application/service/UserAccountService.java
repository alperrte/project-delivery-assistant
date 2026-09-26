package com.pda.user.application.service;

import com.pda.user.UserAccounts;
import com.pda.user.UserRegistrationConflictException;
import com.pda.user.domain.entity.User;
import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.infrastructure.repository.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAccountService implements UserAccounts {

    private final UserRepository users;
    private final BCryptPasswordEncoder passwordEncoder;
    private final String dummyHash;

    public UserAccountService(UserRepository users, BCryptPasswordEncoder passwordEncoder) {
        this.users = users;
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

    private static AuthenticatedUser summary(User user) {
        return new AuthenticatedUser(user.getId(), user.getEmail(), user.getNickname(), user.getGlobalRole().name());
    }
}
