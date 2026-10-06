package com.pda.notification.application;

import com.pda.squad.SquadLifecycleEvents.TeamDeleted;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.IncompleteEventPublications;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

/** Reuses the durable publication registry; other event families keep their existing behavior. */
@Component
public class TeamDeletionPublicationRecovery {
    private static final Logger log = LoggerFactory.getLogger(TeamDeletionPublicationRecovery.class);
    private final IncompleteEventPublications publications;
    public TeamDeletionPublicationRecovery(IncompleteEventPublications publications) { this.publications = publications; }

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void recover() {
        Instant cutoff = Instant.now().minusSeconds(60);
        AtomicInteger selected = new AtomicInteger();
        try {
            publications.resubmitIncompletePublications(publication -> publication.getEvent() instanceof TeamDeleted
                    && publication.getPublicationDate().isBefore(cutoff)
                    && (publication.getLastResubmissionDate() == null || publication.getLastResubmissionDate().isBefore(cutoff))
                    && selected.getAndIncrement() < 50);
        } catch (RuntimeException failure) {
            log.warn("Team deletion notification recovery will retry; no display or auth metadata logged.");
        }
    }
}
