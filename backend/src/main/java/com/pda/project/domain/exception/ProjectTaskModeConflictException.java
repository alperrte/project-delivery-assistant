package com.pda.project.domain.exception;

/** A member tried to configure an archived project's task policy. */
public class ProjectTaskModeConflictException extends RuntimeException {
    public ProjectTaskModeConflictException() { super("Project is archived"); }
}
