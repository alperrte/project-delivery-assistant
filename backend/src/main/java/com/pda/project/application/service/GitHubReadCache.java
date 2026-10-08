package com.pda.project.application.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Small in-memory TTL cache in front of the public GitHub REST API. Unauthenticated GitHub allows only 60 requests
 * per hour per server address, so every member opening the repository page must not become a GitHub call. State is
 * per instance and lost on restart; failed loads are never cached. A TTL of zero disables caching (tests).
 */
@Component
public class GitHubReadCache {

    static final int MAX_ENTRIES = 500;

    private record Entry(Object value, long expiresAtMillis) {}

    private final Clock clock;
    private final long ttlMillis;
    private final Map<String, Entry> entries = new LinkedHashMap<>();

    public GitHubReadCache(Clock clock, @Value("${pda.github.cache-ttl:PT60S}") Duration ttl) {
        this.clock = clock;
        this.ttlMillis = Math.max(0, ttl.toMillis());
    }

    @SuppressWarnings("unchecked")
    public <T> T get(String key, Supplier<T> loader) {
        if (ttlMillis == 0) {
            return loader.get();
        }
        long now = clock.millis();
        synchronized (this) {
            Entry hit = entries.get(key);
            if (hit != null && hit.expiresAtMillis() > now) {
                return (T) hit.value();
            }
        }
        T loaded = loader.get();
        synchronized (this) {
            evictExpired(now);
            entries.put(key, new Entry(loaded, now + ttlMillis));
        }
        return loaded;
    }

    private void evictExpired(long now) {
        Iterator<Map.Entry<String, Entry>> iterator = entries.entrySet().iterator();
        while (iterator.hasNext()) {
            if (iterator.next().getValue().expiresAtMillis() <= now) {
                iterator.remove();
            }
        }
        // Still full of live entries: drop the oldest ones so memory stays bounded.
        iterator = entries.entrySet().iterator();
        while (entries.size() >= MAX_ENTRIES && iterator.hasNext()) {
            iterator.next();
            iterator.remove();
        }
    }
}
