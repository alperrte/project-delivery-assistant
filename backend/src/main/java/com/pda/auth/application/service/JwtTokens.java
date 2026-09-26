package com.pda.auth.application.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtTokens {

    private static final String ISSUER = "pda";
    private final SecretKey signingKey;
    private final Duration accessLifetime;
    private final Duration refreshLifetime;
    private final Clock clock;

    public JwtTokens(@Value("${JWT_SECRET:}") String secret,
                     @Value("${JWT_ACCESS_TOKEN_EXPIRATION_MINUTES:15}") long accessMinutes,
                     @Value("${JWT_REFRESH_TOKEN_EXPIRATION_DAYS:7}") long refreshDays,
                     Clock clock) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32 || secret.startsWith("change_me")) {
            throw new IllegalStateException("JWT_SECRET must be a strong deployment secret of at least 32 bytes");
        }
        if (accessMinutes < 1 || accessMinutes > 60 || refreshDays < 1 || refreshDays > 30) {
            throw new IllegalStateException("JWT lifetimes are outside the supported range");
        }
        this.signingKey = new SecretKeySpec(bytes, "HmacSHA256");
        this.accessLifetime = Duration.ofMinutes(accessMinutes);
        this.refreshLifetime = Duration.ofDays(refreshDays);
        this.clock = clock;
    }

    public IssuedToken issueRefresh(UUID userId) {
        return issue(userId, "refresh", null, refreshLifetime);
    }

    public IssuedToken issueAccess(UUID userId, UUID sessionId) {
        return issue(userId, "access", sessionId, accessLifetime);
    }

    public Optional<AccessIdentity> parseAccess(String token) {
        return parse(token, "access").flatMap(claims -> {
            try {
                return Optional.of(new AccessIdentity(UUID.fromString(claims.getSubject()),
                        UUID.fromString(claims.get("sid", String.class))));
            } catch (RuntimeException exception) {
                return Optional.empty();
            }
        });
    }

    public Optional<UUID> parseRefresh(String token) {
        return parse(token, "refresh").flatMap(claims -> {
            try {
                return Optional.of(UUID.fromString(claims.getSubject()));
            } catch (RuntimeException exception) {
                return Optional.empty();
            }
        });
    }

    public Duration accessLifetime() { return accessLifetime; }
    public Duration refreshLifetime() { return refreshLifetime; }

    private IssuedToken issue(UUID userId, String purpose, UUID sessionId, Duration lifetime) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(lifetime);
        var builder = Jwts.builder().issuer(ISSUER).subject(userId.toString())
                .id(UUID.randomUUID().toString()).issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt)).claim("token_use", purpose);
        if (sessionId != null) {
            builder.claim("sid", sessionId.toString());
        }
        return new IssuedToken(builder.signWith(signingKey).compact(), expiresAt);
    }

    private Optional<Claims> parse(String token, String purpose) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            Claims claims = Jwts.parser().verifyWith(signingKey).requireIssuer(ISSUER)
                    .clock(() -> Date.from(clock.instant()))
                    .build().parseSignedClaims(token).getPayload();
            return purpose.equals(claims.get("token_use", String.class))
                    ? Optional.of(claims) : Optional.empty();
        } catch (JwtException | IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    public record IssuedToken(String value, Instant expiresAt) {}
    public record AccessIdentity(UUID userId, UUID sessionId) {}
}
