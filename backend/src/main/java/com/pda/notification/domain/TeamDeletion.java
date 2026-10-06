package com.pda.notification.domain;

import java.time.Instant;
import java.util.Objects;

/** Immutable display snapshot; reading a deleted team's notification needs no live team lookup. */
public record TeamDeletion(String projectName, String teamName, String actorNickname, Instant occurredAt) {
    public TeamDeletion {
        requireText(projectName, 160, "projectName");
        requireText(teamName, 120, "teamName");
        if (actorNickname != null && actorNickname.length() > 32)
            throw new IllegalArgumentException("actorNickname too long");
        Objects.requireNonNull(occurredAt, "occurredAt");
    }

    private static void requireText(String text, int limit, String field) {
        if (text == null || text.isBlank() || text.length() > limit)
            throw new IllegalArgumentException(field + " is invalid");
    }
}
