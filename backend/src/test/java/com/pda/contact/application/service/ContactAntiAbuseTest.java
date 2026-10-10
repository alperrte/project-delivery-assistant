package com.pda.contact.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.pda.contact.application.service.ContactAntiAbuse.Verdict;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

/** The honeypot and the fill-time trap, with the boundaries that decide between a bot and a person. */
class ContactAntiAbuseTest {

    private static final Instant NOW = Instant.parse("2026-10-10T12:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final ContactAntiAbuse traps = new ContactAntiAbuse(clock, Duration.ofSeconds(3), Duration.ofHours(24), false);

    private Long ago(Duration age) {
        return NOW.minus(age).toEpochMilli();
    }

    @Test
    void anyTextInTheHoneypotMarksABotWhateverTheTimestampSays() {
        assertEquals(Verdict.BOT, traps.judge("http://spam.example", ago(Duration.ofMinutes(1))));
        assertEquals(Verdict.BOT, traps.judge("x", null));
        assertEquals(Verdict.BOT, traps.judge(" a ", ago(Duration.ofHours(30))));
        assertEquals(3, traps.trappedCount());
    }

    @Test
    void anEmptyOrBlankHoneypotIsWhatARealFormSends() {
        assertEquals(Verdict.HUMAN, traps.judge(null, ago(Duration.ofSeconds(10))));
        assertEquals(Verdict.HUMAN, traps.judge("", ago(Duration.ofSeconds(10))));
        assertEquals(Verdict.HUMAN, traps.judge("   ", ago(Duration.ofSeconds(10))));
        assertEquals(0, traps.trappedCount());
    }

    @Test
    void theMinimumFillTimeIsExactlyThreeSeconds() {
        assertEquals(Verdict.BOT, traps.judge(null, ago(Duration.ZERO)));
        assertEquals(Verdict.BOT, traps.judge(null, ago(Duration.ofMillis(2_999))));
        assertEquals(Verdict.HUMAN, traps.judge(null, ago(Duration.ofMillis(3_000))));
        assertEquals(Verdict.HUMAN, traps.judge(null, ago(Duration.ofMillis(3_001))));
    }

    @Test
    void aSmallClockSkewIntoTheFutureStillCountsAsTooFastButAFarFutureIsInvalid() {
        assertEquals(Verdict.BOT, traps.judge(null, NOW.plusSeconds(30).toEpochMilli()));
        assertEquals(Verdict.BOT, traps.judge(null, NOW.plus(Duration.ofMinutes(5)).toEpochMilli()));
        assertEquals(Verdict.STALE_OR_INVALID_TIMESTAMP, traps.judge(null, NOW.plus(Duration.ofMinutes(5)).plusMillis(1).toEpochMilli()));
        assertEquals(Verdict.STALE_OR_INVALID_TIMESTAMP, traps.judge(null, NOW.plus(Duration.ofDays(2)).toEpochMilli()));
    }

    @Test
    void aFormOlderThanTheMaximumAgeIsInvalidNotABot() {
        assertEquals(Verdict.HUMAN, traps.judge(null, ago(Duration.ofHours(24))));
        assertEquals(Verdict.STALE_OR_INVALID_TIMESTAMP, traps.judge(null, ago(Duration.ofHours(24).plusMillis(1))));
        assertEquals(Verdict.STALE_OR_INVALID_TIMESTAMP, traps.judge(null, 0L));
        assertEquals(Verdict.STALE_OR_INVALID_TIMESTAMP, traps.judge(null, -5L));
        assertEquals(Verdict.STALE_OR_INVALID_TIMESTAMP, traps.judge(null, Long.MAX_VALUE));
        assertEquals(Verdict.STALE_OR_INVALID_TIMESTAMP, traps.judge(null, Long.MIN_VALUE));
        assertEquals(0, traps.trappedCount());
    }

    @Test
    void aMissingTimestampIsAcceptedUntilTheTimestampIsRequired() {
        assertEquals(Verdict.HUMAN, traps.judge(null, null));
        ContactAntiAbuse strict = new ContactAntiAbuse(clock, Duration.ofSeconds(3), Duration.ofHours(24), true);
        assertEquals(Verdict.BOT, strict.judge(null, null));
        assertEquals(Verdict.BOT, strict.judge("", null));
        assertEquals(Verdict.HUMAN, strict.judge("", ago(Duration.ofSeconds(5))));
    }
}
