package com.pda.project;

/** Project-wide allowed creation models; null on a project means the founder has not chosen yet. */
public enum TaskManagementMode {
    SIMPLE, ADVANCED, BOTH;

    public boolean allows(String creationMode) {
        return this == BOTH || name().equals(creationMode);
    }
}
