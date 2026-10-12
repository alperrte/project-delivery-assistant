package com.pda.chat.application.service;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Independent from sends and reactions: bounded per-instance brake on "typing" signals. The client sends at most one
 * every few seconds, so 120 per minute and user is generous and only stops a script from flooding the recipients.
 */
@Component
public class ChatTypingRateLimiter {

    private static final int MAX_PER_WINDOW = 120;
    private static final long WINDOW_MILLIS = 60_000;
    private static final int MAX_USERS = 20_000;

    private final Clock clock;
    private final Map<UUID, ArrayDeque<Long>> signals = new HashMap<>();
    private long calls;

    public ChatTypingRateLimiter(Clock clock) {
        this.clock = clock;
    }

    public synchronized boolean tryAcquire(UUID userId) {
        long now = clock.millis();
        if (++calls % 256 == 0 || signals.size() >= MAX_USERS) {
            signals.values().removeIf(queue -> {
                trim(queue, now);
                return queue.isEmpty();
            });
        }
        ArrayDeque<Long> queue = signals.get(userId);
        if (queue == null) {
            if (signals.size() >= MAX_USERS) {
                return false;
            }
            queue = new ArrayDeque<>();
            signals.put(userId, queue);
        } else {
            trim(queue, now);
        }
        if (queue.size() >= MAX_PER_WINDOW) {
            return false;
        }
        queue.addLast(now);
        return true;
    }

    private static void trim(ArrayDeque<Long> queue, long now) {
        while (!queue.isEmpty() && queue.peekFirst() <= now - WINDOW_MILLIS) {
            queue.removeFirst();
        }
    }
}
