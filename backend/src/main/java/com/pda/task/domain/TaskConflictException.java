package com.pda.task.domain;

/** A rejected state change; {@link #code()} is the stable error code the frontend translates (HTTP 409). */
public class TaskConflictException extends RuntimeException {
    private final String code;

    public TaskConflictException(String message) { this("TASK_CONFLICT", message); }

    public TaskConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() { return code; }
}
