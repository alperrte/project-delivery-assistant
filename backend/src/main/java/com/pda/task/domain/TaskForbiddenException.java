package com.pda.task.domain;

import org.springframework.security.access.AccessDeniedException;

/** A permitted caller that still may not do this (for example claiming a task aimed at another team). */
public class TaskForbiddenException extends AccessDeniedException {
    private final String code;

    public TaskForbiddenException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() { return code; }
}
