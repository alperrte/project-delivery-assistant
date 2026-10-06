package com.pda.notification;

import com.pda.notification.application.TeamDeletionPublicationRecovery;
import com.pda.squad.SquadLifecycleEvents.TeamDeleted;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.events.EventPublication;
import org.springframework.modulith.events.IncompleteEventPublications;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TeamDeletionPublicationRecoveryTest {
    @Test void recoveryIsBoundedAndNeverResubmitsAnotherFamilyOrAnInFlightPublication() {
        IncompleteEventPublications registry = mock(IncompleteEventPublications.class);
        TeamDeleted event = new TeamDeleted(UUID.randomUUID(), UUID.randomUUID(), "P", UUID.randomUUID(), "T",
                UUID.randomUUID(), null, Set.of(), Instant.now());
        doAnswer(call -> {
            Predicate<EventPublication> selector = call.getArgument(0);
            EventPublication other = publication(new Object(), Instant.now().minusSeconds(120), null);
            assertFalse(selector.test(other));
            assertFalse(selector.test(publication(event, Instant.now(), null)));
            assertFalse(selector.test(publication(event, Instant.now().minusSeconds(120), Instant.now())));
            for (int i = 0; i < 60; i++) {
                assertEquals(i < 50, selector.test(publication(event, Instant.now().minusSeconds(120), null)));
            }
            return null;
        }).when(registry).resubmitIncompletePublications(any(Predicate.class));
        new TeamDeletionPublicationRecovery(registry).recover();
        verify(registry, times(1)).resubmitIncompletePublications(any(Predicate.class));
    }

    private EventPublication publication(Object event, Instant date, Instant lastAttempt) {
        EventPublication p = mock(EventPublication.class);
        when(p.getEvent()).thenReturn(event);
        when(p.getPublicationDate()).thenReturn(date);
        when(p.getLastResubmissionDate()).thenReturn(lastAttempt);
        return p;
    }
}
