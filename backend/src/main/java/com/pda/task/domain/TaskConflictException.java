package com.pda.task.domain;

public class TaskConflictException extends RuntimeException {
    public TaskConflictException(String message) { super(message); }
}
