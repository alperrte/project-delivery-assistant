package com.pda.project.application.service;

public class MembershipConflictException extends RuntimeException {

    /** The founder is locked into the project: cannot be removed or lose the Project Manager role. */
    public static final String OWNER_PROTECTED = "PROJECT_OWNER_PROTECTED";
    public static final String LAST_PROJECT_MANAGER = "LAST_PROJECT_MANAGER";

    private final String code;

    public MembershipConflictException(String message) {
        this(message, null);
    }

    public MembershipConflictException(String message, String code) {
        super(message);
        this.code = code;
    }

    /** Stable machine-readable reason for the UI, or {@code null} for a generic membership conflict. */
    public String code() {
        return code;
    }
}
