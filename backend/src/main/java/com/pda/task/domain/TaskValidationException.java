package com.pda.task.domain;

/** Invalid task input; {@link #code()} is the stable error code the frontend translates (HTTP 400). */
public class TaskValidationException extends IllegalArgumentException {
    private final String code;

    public TaskValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() { return code; }
}
