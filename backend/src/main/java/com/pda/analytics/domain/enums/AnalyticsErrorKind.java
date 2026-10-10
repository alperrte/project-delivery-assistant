package com.pda.analytics.domain.enums;

import java.util.Optional;

/** The kinds of client-side failure the browser may report. Nothing else about the error (message, stack, URL) is accepted. */
public enum AnalyticsErrorKind {
    /** A React render / error-boundary failure. */
    RENDER("render"),
    /** A code-split chunk or asset could not be loaded. */
    CHUNK_LOAD("chunk_load"),
    UNHANDLED_REJECTION("unhandled_rejection"),
    /** A request to the API failed at the network level. */
    NETWORK("network");

    private final String id;

    AnalyticsErrorKind(String id) {
        this.id = id;
    }

    /** The wire id, e.g. {@code chunk_load}. */
    public String id() {
        return id;
    }

    public static Optional<AnalyticsErrorKind> parse(String value) {
        for (AnalyticsErrorKind kind : values()) {
            if (kind.id.equals(value)) {
                return Optional.of(kind);
            }
        }
        return Optional.empty();
    }
}
