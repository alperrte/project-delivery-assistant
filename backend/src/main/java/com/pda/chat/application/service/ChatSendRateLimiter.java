package com.pda.chat.application.service;

import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * In-memory sliding window over message sends per user (same shape as the other rate limit filters, no new
 * infrastructure): by default {@value #DEFAULT_MAX_SENDS} send attempts per minute, valid or not (a blank or too long
 * message is an attempt too). Keyed by user id, so a shared office address does not throttle colleagues. State is per
 * instance and lost on restart, which is acceptable for a spam brake.
 *
 * <p>The limits are {@code chat.send.max-messages} and {@code chat.send.window-seconds}; the defaults are the
 * production values and are only meant to be raised for automated tests.
 */
@Component
public class ChatSendRateLimiter {

    static final int DEFAULT_MAX_SENDS = 30;
    static final long DEFAULT_WINDOW_SECONDS = 60;
    private static final int MAX_USERS = 20_000;

    private final Clock clock;
    private final int maxSends;
    private final long windowMillis;
    private final Map<UUID, ArrayDeque<Long>> sends = new HashMap<>();
    private long calls;

    public ChatSendRateLimiter(Clock clock) {
        this(clock, DEFAULT_MAX_SENDS, DEFAULT_WINDOW_SECONDS);
    }

    @Autowired
    public ChatSendRateLimiter(Clock clock, @Value("${chat.send.max-messages:" + DEFAULT_MAX_SENDS + "}") int maxSends,
                               @Value("${chat.send.window-seconds:" + DEFAULT_WINDOW_SECONDS + "}") long windowSeconds) {
        if (maxSends < 1 || windowSeconds < 1) {
            throw new IllegalStateException("Chat send rate limit must be at least 1 message per 1 second");
        }
        this.clock = clock;
        this.maxSends = maxSends;
        this.windowMillis = Duration.ofSeconds(windowSeconds).toMillis();
        if (maxSends != DEFAULT_MAX_SENDS || windowSeconds != DEFAULT_WINDOW_SECONDS) {
            LoggerFactory.getLogger(ChatSendRateLimiter.class).warn(
                    "Chat send rate limit differs from the production default ({} per {} s instead of {} per {} s): for test environments only",
                    maxSends, windowSeconds, DEFAULT_MAX_SENDS, DEFAULT_WINDOW_SECONDS);
        }
    }

    /** Counts one send for the user and answers whether it is still within the limit. */
    public synchronized boolean tryAcquire(UUID userId) {
        long now = clock.millis();
        if (++calls % 256 == 0 || sends.size() >= MAX_USERS) {
            sends.values().removeIf(times -> {
                trim(times, now);
                return times.isEmpty();
            });
        }
        ArrayDeque<Long> times = sends.get(userId);
        if (times == null) {
            if (sends.size() >= MAX_USERS) {
                // Table full of distinct active senders: fail closed for newcomers rather than grow without bound.
                return false;
            }
            times = new ArrayDeque<>();
            sends.put(userId, times);
        } else {
            trim(times, now);
        }
        if (times.size() >= maxSends) {
            return false;
        }
        times.addLast(now);
        return true;
    }

    private void trim(ArrayDeque<Long> times, long now) {
        while (!times.isEmpty() && times.peekFirst() <= now - windowMillis) {
            times.removeFirst();
        }
    }
}
