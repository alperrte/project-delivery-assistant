package com.pda.notification.domain;

/** Immutable display snapshot; the notification renders even if the repository later changes or disappears. */
public record RepositoryCommits(String projectName, String repositoryFullName, String branch, int commitCount,
                                boolean truncated, String headMessage, String headAuthor) {
    public RepositoryCommits {
        requireText(projectName, 160, "projectName");
        requireText(repositoryFullName, 201, "repositoryFullName");
        requireText(branch, 250, "branch");
        if (commitCount < 1) throw new IllegalArgumentException("commitCount is invalid");
        headMessage = limit(headMessage, 160);
        headAuthor = limit(headAuthor, 100);
    }

    private static void requireText(String text, int limit, String field) {
        if (text == null || text.isBlank() || text.length() > limit)
            throw new IllegalArgumentException(field + " is invalid");
    }

    private static String limit(String text, int limit) {
        if (text == null || text.isBlank()) return null;
        return text.length() <= limit ? text : text.substring(0, limit - 1) + "…";
    }
}
