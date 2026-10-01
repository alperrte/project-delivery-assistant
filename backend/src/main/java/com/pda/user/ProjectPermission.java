package com.pda.user;

/** Actions that can be allowed inside one project. Every project endpoint must check one of these. */
public enum ProjectPermission {
    /** See the project, its members, tasks and activity. */
    PROJECT_VIEW,
    /** Change the basic project settings. */
    PROJECT_UPDATE,
    /** Archive the project. */
    PROJECT_ARCHIVE,
    /** Invite/remove members, assign or change project roles (including Project Manager). */
    MEMBER_MANAGE,
    /** Create, edit, archive a squad and manage its membership; a squad grants no permission by itself. */
    SQUAD_MANAGE,
    /** Create, edit, delete, reorder and complete/uncomplete a project's success criteria. */
    CRITERIA_MANAGE,
    /** Connect, update or disconnect a project's public GitHub repository link. */
    REPOSITORY_MANAGE,
    /** Create, edit, assign, schedule, prioritise, move, block and close tasks; attach existing labels. */
    TASK_MANAGE,
    /** Create and change labels and milestones themselves. */
    LABEL_MANAGE,
    /** Work on tasks assigned to the caller and make the allowed lifecycle transitions. */
    TASK_WORK,
    /** Comment and open issues. */
    ISSUE_PARTICIPATE,
    /** Manage other people's issues and comments. */
    ISSUE_MANAGE,
    /** Create, edit and delete project-wide calendar reminders; personal reminders only need PROJECT_VIEW. */
    REMINDER_MANAGE,
    /** Create and update test reports and results. */
    TEST_REPORT_WRITE
}
