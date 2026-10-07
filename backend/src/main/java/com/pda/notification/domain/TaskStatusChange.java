package com.pda.notification.domain;

/** Immutable notification snapshot; status names are strings to preserve module boundaries. */
public record TaskStatusChange(String previousStatus, String newStatus, String taskKey,
                               String taskTitle, String actorNickname) {}
