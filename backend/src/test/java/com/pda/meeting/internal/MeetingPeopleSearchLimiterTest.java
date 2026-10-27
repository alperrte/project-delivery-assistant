package com.pda.meeting.internal;

import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

/**
 * The brake on the global attendee lookup: 30 searches per minute and user, per instance. It is shared mutable state hit by many request
 * threads, so what matters is that the count holds under real concurrency, that users never share a window, and that its memory stays bounded.
 */
class MeetingPeopleSearchLimiterTest {
    /** A clock the test moves by hand. */
    static class Hand extends Clock {
        private volatile Instant now=Instant.parse("2026-10-27T09:00:00Z");
        void advance(Duration by) { now=now.plus(by); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test void thirtySearchesPassTheThirtyFirstDoesNotAndTheWindowSlides() {
        Hand clock=new Hand(); var limiter=new MeetingPeopleSearchLimiter(clock); UUID user=UUID.randomUUID();
        for(int i=0;i<30;i++) { assertTrue(limiter.tryAcquire(user),"search "+i); clock.advance(Duration.ofSeconds(1)); }
        assertFalse(limiter.tryAcquire(user),"the 31st inside the minute is refused");
        // The first search was 30 s ago and the last one 1 s ago: the window is sliding, not a fixed bucket, so one slot frees up exactly when the oldest one ages out.
        clock.advance(Duration.ofSeconds(30)); assertTrue(limiter.tryAcquire(user),"the oldest search is more than a minute old now");
        assertFalse(limiter.tryAcquire(user),"only one slot was freed");
        clock.advance(Duration.ofSeconds(61)); for(int i=0;i<30;i++) assertTrue(limiter.tryAcquire(user),"a quiet minute gives the whole allowance back: "+i);
    }

    @Test void everyUserHasTheirOwnWindow() {
        var limiter=new MeetingPeopleSearchLimiter(new Hand()); UUID busy=UUID.randomUUID(),other=UUID.randomUUID();
        for(int i=0;i<30;i++) assertTrue(limiter.tryAcquire(busy));
        assertFalse(limiter.tryAcquire(busy));
        assertTrue(limiter.tryAcquire(other),"one user using up the allowance never takes it from another");
    }

    @Test void concurrentSearchesOfOneUserAreCountedExactly() throws Exception {
        var limiter=new MeetingPeopleSearchLimiter(new Hand()); UUID user=UUID.randomUUID(); AtomicInteger allowed=new AtomicInteger();
        int threads=64,attemptsEach=10; CountDownLatch go=new CountDownLatch(1); ExecutorService pool=Executors.newFixedThreadPool(threads);
        try {
            List<Future<?>> done=new ArrayList<>();
            for(int t=0;t<threads;t++) done.add(pool.submit(() -> { go.await(); for(int i=0;i<attemptsEach;i++) if(limiter.tryAcquire(user)) allowed.incrementAndGet(); return null; }));
            go.countDown(); for(Future<?> f:done) f.get();
        } finally { pool.shutdownNow(); }
        assertEquals(30,allowed.get(),"640 simultaneous attempts let exactly the allowance through");
    }

    @Test void concurrentSearchesOfDifferentUsersDoNotCostEachOther() throws Exception {
        var limiter=new MeetingPeopleSearchLimiter(new Hand()); int users=40; AtomicInteger allowed=new AtomicInteger();
        CountDownLatch go=new CountDownLatch(1); ExecutorService pool=Executors.newFixedThreadPool(users);
        try {
            List<Future<?>> done=new ArrayList<>();
            for(int u=0;u<users;u++) { UUID user=UUID.randomUUID(); done.add(pool.submit(() -> { go.await(); for(int i=0;i<35;i++) if(limiter.tryAcquire(user)) allowed.incrementAndGet(); return null; })); }
            go.countDown(); for(Future<?> f:done) f.get();
        } finally { pool.shutdownNow(); }
        assertEquals(users*30,allowed.get(),"each of the users got exactly their own 30");
    }

    @Test void memoryStaysBoundedAndRecoversWhenTheWindowsExpire() {
        Hand clock=new Hand(); var limiter=new MeetingPeopleSearchLimiter(clock);
        for(int i=0;i<20_000;i++) assertTrue(limiter.tryAcquire(UUID.randomUUID()),"user "+i);
        // The table is capped: when 20 000 different users searched within one minute, a new one is refused rather than the table growing without limit.
        assertFalse(limiter.tryAcquire(UUID.randomUUID()),"the cap holds while all the windows are still open");
        clock.advance(Duration.ofSeconds(61));
        assertTrue(limiter.tryAcquire(UUID.randomUUID()),"expired windows are swept away, so there is room again");
        for(int i=0;i<1_000;i++) assertTrue(limiter.tryAcquire(UUID.randomUUID()));
    }
}
