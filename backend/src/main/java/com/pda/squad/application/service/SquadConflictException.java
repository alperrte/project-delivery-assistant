package com.pda.squad.application.service;

import java.util.List;

/**
 * Thrown when a team action conflicts with existing state (e.g. a duplicate membership). The optional
 * {@code code} is a stable machine-readable reason the UI maps to a localised message; {@code members} names the
 * people the conflict is about, when that helps the user resolve it.
 */
public class SquadConflictException extends RuntimeException {

    public static final String MEMBER_EXISTS = "TEAM_MEMBER_EXISTS";
    public static final String CIRCULAR_PARENT = "TEAM_CIRCULAR_PARENT";
    public static final String HAS_CHILDREN = "TEAM_HAS_CHILDREN";
    public static final String LAST_MEMBERSHIP = "TEAM_LAST_MEMBERSHIP";
    public static final String ARCHIVE_WOULD_ORPHAN = "TEAM_ARCHIVE_WOULD_ORPHAN";

    private final String code;
    private final List<String> members;

    public SquadConflictException(String message) {
        this(message, null, List.of());
    }

    public SquadConflictException(String message, String code) {
        this(message, code, List.of());
    }

    public SquadConflictException(String message, String code, List<String> members) {
        super(message);
        this.code = code;
        this.members = List.copyOf(members);
    }

    public String code() {
        return code;
    }

    public List<String> members() {
        return members;
    }
}
