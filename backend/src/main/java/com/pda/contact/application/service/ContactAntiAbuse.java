package com.pda.contact.application.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The two invisible bot traps of the contact form (no CAPTCHA, so no third party and no data transfer):
 * <ul>
 *   <li>the honeypot: the form has an extra field real visitors never see; any text in it marks a bot;</li>
 *   <li>the fill-time trap: the browser reports when the form was shown (epoch milliseconds); a form submitted sooner
 *       than {@code pda.contact.min-fill-time} (default 3 seconds) after being shown was not filled by a person.</li>
 * </ul>
 * A bot-like submission gets the same success answer as a real one but is neither mailed nor stored, so the bot learns
 * nothing from the response. Only a counter line is logged (never any content). A timestamp from the future by more than
 * the allowed clock skew, or older than {@code pda.contact.max-form-age} (default 24 hours), is not evidence of a bot -
 * it is a visitor with a wrong clock or a form left open - so it is reported as an invalid {@code startedAt} instead
 * of being silently dropped (a person must never lose a message without being told).
 */
@Component
public class ContactAntiAbuse {

    private static final Logger log = LoggerFactory.getLogger(ContactAntiAbuse.class);
    static final Duration MAX_CLOCK_SKEW = Duration.ofMinutes(5);

    public enum Verdict { HUMAN, BOT, STALE_OR_INVALID_TIMESTAMP }

    private final Clock clock;
    private final Duration minFillTime;
    private final Duration maxFormAge;
    private final boolean requireStartedAt;
    private final AtomicLong trapped = new AtomicLong();

    public ContactAntiAbuse(Clock clock,
                            @Value("${pda.contact.min-fill-time:PT3S}") Duration minFillTime,
                            @Value("${pda.contact.max-form-age:PT24H}") Duration maxFormAge,
                            @Value("${pda.contact.require-started-at:false}") boolean requireStartedAt) {
        this.clock = clock;
        this.minFillTime = minFillTime;
        this.maxFormAge = maxFormAge;
        this.requireStartedAt = requireStartedAt;
    }

    /** Judges one submission from the two trap fields. Counts and logs a trapped one. */
    public Verdict judge(String website, Long startedAtMillis) {
        if (website != null && !website.isBlank()) {
            return trapped("honeypot");
        }
        if (startedAtMillis == null) {
            return requireStartedAt ? trapped("missing-timestamp") : Verdict.HUMAN;
        }
        Instant now = clock.instant();
        Instant startedAt;
        try {
            startedAt = Instant.ofEpochMilli(startedAtMillis);
        } catch (java.time.DateTimeException | ArithmeticException exception) {
            return Verdict.STALE_OR_INVALID_TIMESTAMP;
        }
        Duration age = Duration.between(startedAt, now);
        if (age.compareTo(MAX_CLOCK_SKEW.negated()) < 0 || age.compareTo(maxFormAge) > 0) {
            return Verdict.STALE_OR_INVALID_TIMESTAMP;
        }
        return age.compareTo(minFillTime) < 0 ? trapped("too-fast") : Verdict.HUMAN;
    }

    /** How many submissions the traps have swallowed since start-up (for tests and diagnostics). */
    public long trappedCount() {
        return trapped.get();
    }

    private Verdict trapped(String reason) {
        long total = trapped.incrementAndGet();
        log.info("Contact submission dropped by the bot trap ({}). total={}", reason, total);
        return Verdict.BOT;
    }
}
