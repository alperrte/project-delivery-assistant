package com.pda.task.infrastructure;

import com.pda.task.domain.*;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Composable, parameter-bound task filters and orderings; nothing here concatenates user input into a query. */
public final class TaskSpecifications {
    public static final Set<String> SORT_FIELDS =
            Set.of("taskNumber", "createdAt", "updatedAt", "deadlineAt", "priority");

    private TaskSpecifications() {}

    public static Specification<Task> inProject(UUID projectId) {
        return (root, query, cb) -> cb.equal(root.get("projectId"), projectId);
    }

    public static Specification<Task> inProjects(Collection<UUID> projectIds) {
        return (root, query, cb) -> projectIds.isEmpty() ? cb.disjunction() : root.get("projectId").in(projectIds);
    }

    public static Specification<Task> active() {
        return (root, query, cb) -> cb.isNull(root.get("archivedAt"));
    }

    public static Specification<Task> statusIn(Collection<TaskStatus> statuses) {
        return (root, query, cb) -> root.get("status").in(statuses);
    }

    public static Specification<Task> notDone() {
        return (root, query, cb) -> cb.notEqual(root.get("status"), TaskStatus.DONE);
    }

    public static Specification<Task> done() {
        return (root, query, cb) -> cb.equal(root.get("status"), TaskStatus.DONE);
    }

    public static Specification<Task> priorityIn(Collection<TaskPriority> priorities) {
        return (root, query, cb) -> root.get("priority").in(priorities);
    }

    public static Specification<Task> assignedTo(UUID userId) {
        return (root, query, cb) -> cb.exists(assignmentOf(root, query, cb, userId));
    }

    public static Specification<Task> unassigned() {
        return (root, query, cb) -> cb.not(cb.exists(assignmentOf(root, query, cb, null)));
    }

    public static Specification<Task> labelIn(Collection<UUID> labelIds) {
        return (root, query, cb) -> {
            Subquery<Integer> sub = query.subquery(Integer.class);
            Root<TaskLabel> label = sub.from(TaskLabel.class);
            sub.select(cb.literal(1)).where(cb.equal(label.get("taskId"), root.get("id")),
                    label.get("labelId").in(labelIds));
            return cb.exists(sub);
        };
    }

    public static Specification<Task> inSprint(UUID sprintId) {
        return (root, query, cb) -> cb.equal(root.get("sprintId"), sprintId);
    }

    public static Specification<Task> inAnySprint(Collection<UUID> sprintIds) {
        return (root, query, cb) -> sprintIds.isEmpty() ? cb.disjunction() : root.get("sprintId").in(sprintIds);
    }

    public static Specification<Task> backlog() {
        return (root, query, cb) -> cb.isNull(root.get("sprintId"));
    }

    public static Specification<Task> poolOpen() {
        return (root, query, cb) -> cb.isTrue(root.get("poolOpen"));
    }

    public static Specification<Task> childOf(UUID parentId) {
        return (root, query, cb) -> cb.equal(root.get("parentTaskId"), parentId);
    }

    public static Specification<Task> topLevel() {
        return (root, query, cb) -> cb.isNull(root.get("parentTaskId"));
    }

    public static Specification<Task> blocked() {
        return (root, query, cb) -> cb.isTrue(root.get("blocked"));
    }

    /** Open tasks whose deadline is already behind {@code now}. */
    public static Specification<Task> overdue(Instant now) {
        return (root, query, cb) -> cb.and(cb.isNotNull(root.get("deadlineAt")),
                cb.lessThan(root.get("deadlineAt"), now), cb.notEqual(root.get("status"), TaskStatus.DONE));
    }

    /** Open tasks due inside {@code (now, until]}. */
    public static Specification<Task> dueBetween(Instant now, Instant until) {
        return (root, query, cb) -> cb.and(cb.isNotNull(root.get("deadlineAt")),
                cb.greaterThanOrEqualTo(root.get("deadlineAt"), now),
                cb.lessThanOrEqualTo(root.get("deadlineAt"), until),
                cb.notEqual(root.get("status"), TaskStatus.DONE));
    }

    /** Title contains the text, or the task key starts with it; {@code %}, {@code _} and {@code \} are literals. */
    public static Specification<Task> text(String q) {
        String escaped = q.toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("title")), "%" + escaped + "%", '\\'),
                cb.like(cb.lower(root.get("taskKey")), escaped + "%", '\\'));
    }

    /** Orders the page query only (the count query must stay unordered); ties fall back to the newest task. */
    public static Specification<Task> orderBy(String field, boolean ascending) {
        return (root, query, cb) -> {
            Class<?> type = query.getResultType();
            if (type == Long.class || type == long.class) return null;
            List<Order> orders = new ArrayList<>();
            Expression<?> expression;
            if ("priority".equals(field)) {
                expression = cb.selectCase().when(cb.equal(root.get("priority"), TaskPriority.CRITICAL), 3)
                        .when(cb.equal(root.get("priority"), TaskPriority.HIGH), 2)
                        .when(cb.equal(root.get("priority"), TaskPriority.MEDIUM), 1).otherwise(0);
            } else {
                expression = root.get(field);
            }
            if ("deadlineAt".equals(field)) {
                orders.add(cb.asc(cb.selectCase().when(cb.isNull(root.get(field)), 1).otherwise(0)));
            }
            orders.add(ascending ? cb.asc(expression) : cb.desc(expression));
            if (!"taskNumber".equals(field)) orders.add(cb.desc(root.get("taskNumber")));
            query.orderBy(orders);
            return null;
        };
    }

    private static Subquery<Integer> assignmentOf(Root<Task> root, CriteriaQuery<?> query, CriteriaBuilder cb,
                                                  UUID userId) {
        Subquery<Integer> sub = query.subquery(Integer.class);
        Root<TaskAssignment> assignment = sub.from(TaskAssignment.class);
        Predicate sameTask = cb.equal(assignment.get("taskId"), root.get("id"));
        sub.select(cb.literal(1)).where(userId == null ? sameTask
                : cb.and(sameTask, cb.equal(assignment.get("userId"), userId)));
        return sub;
    }
}
