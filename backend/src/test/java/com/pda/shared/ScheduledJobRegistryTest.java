package com.pda.shared;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.pda.shared.ScheduledJobRegistry.JobRun;
import com.pda.shared.ScheduledJobRegistry.Outcome;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class ScheduledJobRegistryTest {

    private final Instant now = Instant.parse("2026-10-10T03:30:00Z");
    private final ScheduledJobRegistry registry = new ScheduledJobRegistry(Clock.fixed(now, ZoneOffset.UTC));

    @Test
    void aRegisteredJobShowsAsNotRunYetAndKeepsItsLastRunAfterwards() {
        registry.register("b.job");
        registry.register("a.job");
        assertEquals(List.of(new JobRun("a.job", null, null, 0), new JobRun("b.job", null, null, 0)), registry.snapshot());

        registry.success("a.job", 7);
        registry.register("a.job");
        assertEquals(new JobRun("a.job", now, Outcome.SUCCESS, 7), registry.snapshot().get(0));

        registry.failure("a.job");
        assertEquals(new JobRun("a.job", now, Outcome.FAILURE, 0), registry.snapshot().get(0));
        assertNull(registry.snapshot().get(1).lastRunAt());
    }
}
