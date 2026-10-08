package com.pda.project.domain.enums;

/**
 * How much of a connected repository the project follows. {@code BASIC}: the repository is linked and the latest
 * default-branch commits are shown. {@code ADVANCED}: additionally the branches, the commits of every branch and
 * the merged/unmerged split. Notifications are default-branch only in both modes.
 */
public enum RepositoryTrackingMode {
    BASIC,
    ADVANCED
}
