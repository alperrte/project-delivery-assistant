package com.pda.user.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.user.domain.entity.UserSession;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class UserSessionTest {

    @Test
    void rotationInvalidatesOldTokenAndRevocationStopsSession() {
        Instant now = Instant.now();
        String firstToken = UUID.randomUUID().toString();
        String secondToken = UUID.randomUUID().toString();
        UserSession session = UserSession.open(UUID.randomUUID(), firstToken,
                now.plus(7, ChronoUnit.DAYS));

        assertTrue(session.matchesRefreshToken(firstToken));
        assertThrows(IllegalStateException.class, () -> session.rotate(UUID.randomUUID().toString(), secondToken,
                now.plus(7, ChronoUnit.DAYS), now));
        assertThrows(IllegalArgumentException.class, () -> session.rotate(firstToken, firstToken,
                now.plus(7, ChronoUnit.DAYS), now));

        session.rotate(firstToken, secondToken, now.plus(8, ChronoUnit.DAYS), now);
        assertFalse(session.matchesRefreshToken(firstToken));
        assertTrue(session.matchesRefreshToken(secondToken));
        assertEquals(now, session.getLastUsedAt());

        session.revoke(now);
        assertFalse(session.isActive(now));
        assertThrows(IllegalStateException.class, () -> session.rotate(secondToken, UUID.randomUUID().toString(),
                now.plus(9, ChronoUnit.DAYS), now));
    }
}
