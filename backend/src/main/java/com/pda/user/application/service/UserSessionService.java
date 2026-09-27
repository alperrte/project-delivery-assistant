package com.pda.user.application.service;

import com.pda.user.UserSessions;
import com.pda.user.domain.entity.UserSession;
import com.pda.user.infrastructure.repository.UserSessionRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserSessionService implements UserSessions {

    private static final Logger log = LoggerFactory.getLogger(UserSessionService.class);

    private final UserSessionRepository sessions;

    public UserSessionService(UserSessionRepository sessions) {
        this.sessions = sessions;
    }

    @Override
    @Transactional
    public UUID open(UUID userId, String refreshToken, Instant expiresAt, String userAgent) {
        return sessions.saveAndFlush(UserSession.open(userId, refreshToken, expiresAt, userAgent)).getId();
    }

    @Override
    @Transactional
    public Optional<UUID> rotate(UUID userId, String currentRefreshToken, String nextRefreshToken,
                                 Instant nextExpiresAt, Instant now) {
        String currentHash = UserSession.hashRefreshToken(currentRefreshToken);
        Optional<UserSession> current = sessions.findForRotationByRefreshTokenHash(currentHash)
                .filter(session -> session.getUserId().equals(userId))
                .filter(session -> session.isActive(now));
        if (current.isPresent()) {
            UserSession session = current.get();
            session.rotate(currentRefreshToken, nextRefreshToken, nextExpiresAt, now);
            return Optional.of(session.getId());
        }
        sessions.findForReplayCheckByPreviousRefreshTokenHash(currentHash)
                .filter(session -> session.getUserId().equals(userId))
                .filter(session -> session.isActive(now))
                .ifPresent(session -> {
                    session.revoke(now);
                    log.warn("Refresh token reuse detected; session revoked. sessionId={} userId={}",
                            session.getId(), session.getUserId());
                });
        return Optional.empty();
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

    @Override
    @Transactional(readOnly = true)
    public List<SessionView> listActive(UUID userId, Instant now) {
        return sessions.findByUserIdAndRevokedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(userId, now).stream()
                .map(session -> new SessionView(session.getId(), session.getCreatedAt(),
                        session.getLastUsedAt(), session.getExpiresAt(), session.getUserAgent()))
                .toList();
    }

    @Override
    @Transactional
    public boolean revokeById(UUID userId, UUID sessionId, Instant now) {
        return sessions.findById(sessionId)
                .filter(session -> session.getUserId().equals(userId))
                .filter(session -> session.isActive(now))
                .map(session -> {
                    session.revoke(now);
                    return true;
                })
                .orElse(false);
    }

    @Override
    @Transactional
    public int revokeAll(UUID userId, Instant now) {
        return revokeOthers(userId, null, now);
    }

    @Override
    @Transactional(readOnly = true)
    public long countActive(UUID userId, Instant now) {
        return sessions.countByUserIdAndRevokedAtIsNullAndExpiresAtAfter(userId, now);
    }

    @Override
    @Transactional
    public int revokeOthers(UUID userId, UUID currentSessionId, Instant now) {
        List<UserSession> others = sessions.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(userId, now).stream()
                .filter(session -> !session.getId().equals(currentSessionId))
                .toList();
        others.forEach(session -> session.revoke(now));
        return others.size();
    }
}
