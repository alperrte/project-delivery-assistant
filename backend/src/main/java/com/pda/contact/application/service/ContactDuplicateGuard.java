package com.pda.contact.application.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Refuses the same message from the same address twice within a minute (a double click, a stuck retry, a script).
 * It keeps only a hash with a timestamp, in memory, and forgets it after the window: the message itself is never
 * stored. It guards one instance; the per-address rate limit is the cross-instance protection.
 */
@Component
public class ContactDuplicateGuard {

    static final Duration WINDOW = Duration.ofSeconds(60);
    private static final int MAX_ENTRIES = 10_000;

    private final Map<String, Instant> recent = new ConcurrentHashMap<>();
    private final Clock clock;

    public ContactDuplicateGuard(Clock clock) {
        this.clock = clock;
    }

    public static String keyOf(ContactMessage message) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(message.email().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            digest.update((byte) '\n');
            digest.update(message.message().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** True when this is the first sighting inside the window (and registers it); false for a repeat. */
    public boolean tryAcquire(String key) {
        Instant now = clock.instant();
        if (recent.size() >= MAX_ENTRIES) {
            recent.values().removeIf(at -> at.plus(WINDOW).isBefore(now));
        }
        boolean[] first = {false};
        recent.compute(key, (k, at) -> {
            if (at == null || !at.plus(WINDOW).isAfter(now)) {
                first[0] = true;
                return now;
            }
            return at;
        });
        return first[0];
    }

    /** Lets the person try again after a delivery failure. */
    public void release(String key) {
        recent.remove(key);
    }
}
