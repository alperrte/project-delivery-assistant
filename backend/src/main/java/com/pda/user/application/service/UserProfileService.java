package com.pda.user.application.service;

import com.pda.user.UserAccounts;
import com.pda.user.domain.NicknameRules;
import com.pda.user.infrastructure.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class UserProfileService {
    private final UserRepository users;
    private final UserAccounts accounts;
    public UserProfileService(UserRepository users, UserAccounts accounts) { this.users = users; this.accounts = accounts; }

    @Transactional
    public UserAccounts.AuthenticatedUser rename(UUID actorId, String requested) {
        String nickname = NicknameRules.normalize(requested);
        if (!NicknameRules.valid(nickname)) throw new IllegalArgumentException("Invalid nickname");
        var user = users.lockActiveProfile(actorId).orElseThrow(() -> new NoSuchElementException("Account unavailable"));
        if (!nickname.equals(user.getNickname())) {
            if (users.existsByNickname(nickname)) throw new NicknameTakenException();
            user.renameNickname(nickname);
            try { users.saveAndFlush(user); }
            catch (DataIntegrityViolationException conflict) {
                for (Throwable cause = conflict; cause != null; cause = cause.getCause()) {
                    if (cause instanceof org.hibernate.exception.ConstraintViolationException violation
                            && "uk_users_nickname".equals(violation.getConstraintName())) throw new NicknameTakenException();
                }
                throw conflict;
            }
        }
        return accounts.findActiveById(actorId).orElseThrow(() -> new NoSuchElementException("Account unavailable"));
    }
}
