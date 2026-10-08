package com.pda.project.application.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * In-memory sliding window over repository read requests per user (default 60 per minute), so a member cannot burn
 * the server's shared GitHub quota by refreshing the repository page in a loop. Keyed by user id; state is per
 * instance and lost on restart, which is acceptable for a brake.
 */
@Component
public class RepositoryReadRateLimiter {

    static final int DEFAULT_MAX_REQUESTS = 60;
    static final long WINDOW_MILLIS = 60_000;
    private static final int MAX_USERS = 20_000;

    private final Clock clock;
    private final int maxRequests;
    private final Map<UUID, ArrayDeque<Long>> requests = new HashMap<>();
    private long calls;

    public RepositoryReadRateLimiter(Clock clock,
                                     @Value("${pda.github.read-limit-per-minute:" + DEFAULT_MAX_REQUESTS + "}") int maxRequests) {
        if (maxRequests < 1) {
            throw new IllegalStateException("Repository read limit must be at least 1 request per minute");
        }
        this.clock = clock;
        this.maxRequests = maxRequests;
    }

    /** Counts one read for the user and answers whether it is still within the limit. */
    public synchronized boolean tryAcquire(UUID userId) {
        long now = clock.millis();
        if (++calls % 256 == 0 || requests.size() >= MAX_USERS) {
            requests.values().removeIf(times -> {
                trim(times, now);
                return times.isEmpty();
            });
        }
        ArrayDeque<Long> times = requests.get(userId);
        if (times == null) {
            if (requests.size() >= MAX_USERS) {
                return false;
            }
            times = new ArrayDeque<>();
            requests.put(userId, times);
        } else {
            trim(times, now);
        }
        if (times.size() >= maxRequests) {
            return false;
        }
        times.addLast(now);
        return true;
    }

    private static void trim(ArrayDeque<Long> times, long now) {
        while (!times.isEmpty() && times.peekFirst() <= now - WINDOW_MILLIS) {
            times.removeFirst();
        }
    }
}
