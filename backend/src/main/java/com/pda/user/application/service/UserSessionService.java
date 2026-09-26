package com.pda.user.application.service;

import com.pda.user.UserSessions;
import com.pda.user.domain.entity.UserSession;
import com.pda.user.infrastructure.repository.UserSessionRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserSessionService implements UserSessions {

    private final UserSessionRepository sessions;

    public UserSessionService(UserSessionRepository sessions) {
        this.sessions = sessions;
    }

    @Override
    @Transactional
    public UUID open(UUID userId, String refreshToken, Instant expiresAt) {
        return sessions.saveAndFlush(UserSession.open(userId, refreshToken, expiresAt)).getId();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isActive(UUID sessionId, UUID userId, Instant now) {
        return sessions.findById(sessionId)
                .filter(session -> session.getUserId().equals(userId))
                .filter(session -> session.isActive(now))
                .isPresent();
    }

    @Override
    @Transactional
    public boolean revoke(UUID userId, String refreshToken, Instant now) {
        return sessions.findByRefreshTokenHash(UserSession.hashRefreshToken(refreshToken))
                .filter(session -> session.getUserId().equals(userId))
                .filter(session -> session.isActive(now))
                .map(session -> {
                    session.revoke(now);
                    return true;
                })
                .orElse(false);
    }
}
