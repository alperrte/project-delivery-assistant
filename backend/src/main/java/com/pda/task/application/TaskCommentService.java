package com.pda.task.application;

import com.pda.task.TaskEvents;
import com.pda.task.application.TaskView.PersonRef;
import com.pda.task.domain.*;
import com.pda.task.infrastructure.TaskActivityRepository;
import com.pda.task.infrastructure.TaskCommentMentionRepository;
import com.pda.task.infrastructure.TaskCommentRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.UserAccounts;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Comments are stored and returned as plain text. A mention is the literal token {@code @[userId]}; only active
 * members of the project count, anything else stays ordinary text and notifies nobody.
 */
@Service
public class TaskCommentService {
    static final int MAX_MENTIONS = 20;
    private static final Pattern MENTION =
            Pattern.compile("@\\[([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})]");

    private final TaskSupport support;
    private final TaskCommentRepository comments;
    private final TaskCommentMentionRepository mentions;
    private final TaskActivityRepository activities;
    private final UserAccounts users;
    private final Clock clock;

    public TaskCommentService(TaskSupport support, TaskCommentRepository comments,
                              TaskCommentMentionRepository mentions, TaskActivityRepository activities,
                              UserAccounts users, Clock clock) {
        this.support = support; this.comments = comments; this.mentions = mentions; this.activities = activities;
        this.users = users; this.clock = clock;
    }

    /** A deleted comment keeps its place in the thread but never exposes its body. */
    public record CommentView(UUID id, UUID taskId, UUID authorId, String authorName, String body, boolean deleted,
                              Instant createdAt, Instant editedAt, List<PersonRef> mentions) {}

    @Transactional(readOnly = true)
    public Page<CommentView> list(UUID projectId, UUID taskId, UUID actor, int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid paging");
        }
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.visible(projectId, taskId);
        List<TaskComment> all = new ArrayList<>(comments.findByTaskId(taskId));
        all.sort(Comparator.comparing(TaskComment::getCreatedAt));
        int from = Math.min(page * size, all.size());
        List<TaskComment> slice = all.subList(from, Math.min(from + size, all.size()));
        return new PageImpl<>(views(slice), PageRequest.of(page, size), all.size());
    }

    /** One row of the merged timeline: exactly one of {@code comment} / {@code event} is set, matching {@code kind}. */
    public record TimelineEntry(String kind, Instant at, CommentView comment, EventView event) {}

    public record EventView(UUID id, UUID actorId, String actorName, ActivityType type, String field,
                            String oldValue, String newValue, Instant createdAt) {}

    /** Comments and activities newest first; {@code filter} is ALL, COMMENTS or EVENTS. */
    @Transactional(readOnly = true)
    public Page<TimelineEntry> timeline(UUID projectId, UUID taskId, UUID actor, String filter, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || !Set.of("ALL", "COMMENTS", "EVENTS").contains(filter)) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid timeline request");
        }
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.visible(projectId, taskId);
        List<TaskComment> commentRows = filter.equals("EVENTS") ? List.of() : comments.findByTaskId(taskId);
        List<TaskActivity> activityRows = filter.equals("COMMENTS") ? List.of() : activities.findByTaskId(taskId);
        List<Object[]> merged = new ArrayList<>(commentRows.size() + activityRows.size());
        commentRows.forEach(c -> merged.add(new Object[]{c.getCreatedAt(), c}));
        activityRows.forEach(a -> merged.add(new Object[]{a.getCreatedAt(), a}));
        merged.sort((x, y) -> ((Instant) y[0]).compareTo((Instant) x[0]));
        int from = Math.min(page * size, merged.size());
        List<Object[]> slice = merged.subList(from, Math.min(from + size, merged.size()));

        List<TaskComment> pageComments = new ArrayList<>();
        Set<UUID> actorIds = new HashSet<>();
        for (Object[] row : slice) {
            if (row[1] instanceof TaskComment c) pageComments.add(c);
            else if (row[1] instanceof TaskActivity a && a.getActorId() != null) actorIds.add(a.getActorId());
        }
        Map<UUID, CommentView> commentViews = views(pageComments).stream()
                .collect(Collectors.toMap(CommentView::id, v -> v));
        Map<UUID, UserAccounts.AuthenticatedUser> names = actorIds.isEmpty() ? Map.of() : users.findActiveByIds(actorIds);
        List<TimelineEntry> entries = new ArrayList<>(slice.size());
        for (Object[] row : slice) {
            if (row[1] instanceof TaskComment c) {
                entries.add(new TimelineEntry("COMMENT", c.getCreatedAt(), commentViews.get(c.getId()), null));
            } else if (row[1] instanceof TaskActivity a) {
                UserAccounts.AuthenticatedUser who = a.getActorId() == null ? null : names.get(a.getActorId());
                entries.add(new TimelineEntry("EVENT", a.getCreatedAt(), null, new EventView(a.getId(),
                        a.getActorId(), who == null ? null : who.nickname(), a.getType(), a.getField(),
                        a.getOldValue(), a.getNewValue(), a.getCreatedAt())));
            }
        }
        return new PageImpl<>(entries, PageRequest.of(page, size), merged.size());
    }

    @Transactional
    public CommentView create(UUID projectId, UUID taskId, UUID actor, String body) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_WORK);
        Task task = support.mutable(projectId, taskId);
        TaskComment comment = comments.save(new TaskComment(taskId, projectId, actor, body));
        Set<UUID> mentioned = saveMentions(projectId, comment, Set.of());
        task.touchedBy(actor);
        support.watch(taskId, actor);
        support.watchAll(taskId, mentioned);
        publish(taskId, projectId, comment, actor, mentioned);
        return views(List.of(comment)).get(0);
    }

    @Transactional
    public CommentView edit(UUID projectId, UUID taskId, UUID commentId, UUID actor, String body) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_WORK);
        support.mutable(projectId, taskId);
        TaskComment comment = comments.findByIdAndTaskId(commentId, taskId)
                .orElseThrow(() -> new NoSuchElementException("Comment not found"));
        if (comment.isDeleted()) throw new NoSuchElementException("Comment not found");
        if (!comment.getAuthorId().equals(actor)) throw new AccessDeniedException("Only the author may edit");
        Set<UUID> before = mentions.findByCommentIds(List.of(commentId)).stream()
                .map(TaskCommentMention::getUserId).collect(Collectors.toSet());
        comment.edit(body);
        Set<UUID> now = saveMentions(projectId, comment, before);
        Set<UUID> fresh = new HashSet<>(now);
        fresh.removeAll(before);
        support.watchAll(taskId, fresh);
        if (!fresh.isEmpty()) {
            support.publish(new TaskEvents.TaskMentionedEvent(taskId, projectId, commentId, actor,
                    withoutActor(fresh, actor), clock.instant()));
        }
        return views(List.of(comment)).get(0);
    }

    @Transactional
    public void delete(UUID projectId, UUID taskId, UUID commentId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.mutable(projectId, taskId);
        TaskComment comment = comments.findByIdAndTaskId(commentId, taskId)
                .orElseThrow(() -> new NoSuchElementException("Comment not found"));
        if (!comment.getAuthorId().equals(actor) && !support.can(projectId, actor, ProjectPermission.ISSUE_MANAGE)) {
            throw new AccessDeniedException("Comment permission denied");
        }
        comment.delete(actor);
        mentions.deleteByCommentId(commentId);
    }

    /** Active members mentioned in the body, in one lookup; replaces the comment's stored mentions. */
    private Set<UUID> saveMentions(UUID projectId, TaskComment comment, Set<UUID> existing) {
        Set<UUID> tokens = new LinkedHashSet<>();
        Matcher matcher = MENTION.matcher(comment.getBody());
        while (matcher.find()) tokens.add(UUID.fromString(matcher.group(1)));
        if (tokens.size() > MAX_MENTIONS) {
            throw new TaskValidationException("TASK_TOO_MANY_MENTIONS", "Too many mentions");
        }
        Set<UUID> valid = tokens.isEmpty() ? Set.of() : support.projects().activeMemberIds(projectId, tokens);
        if (!existing.isEmpty()) mentions.deleteByCommentId(comment.getId());
        mentions.flush();
        for (UUID userId : valid) mentions.save(new TaskCommentMention(comment.getId(), userId));
        return valid;
    }

    private void publish(UUID taskId, UUID projectId, TaskComment comment, UUID actor, Set<UUID> mentioned) {
        Set<UUID> recipients = new LinkedHashSet<>(support.followerIds(taskId));
        recipients.removeAll(mentioned);
        support.publish(new TaskEvents.TaskCommentedEvent(taskId, projectId, comment.getId(), actor,
                Collections.unmodifiableSet(recipients), clock.instant()));
        Set<UUID> toNotify = withoutActor(mentioned, actor);
        if (!toNotify.isEmpty()) {
            support.publish(new TaskEvents.TaskMentionedEvent(taskId, projectId, comment.getId(), actor, toNotify,
                    clock.instant()));
        }
    }

    private static Set<UUID> withoutActor(Set<UUID> ids, UUID actor) {
        Set<UUID> copy = new LinkedHashSet<>(ids);
        copy.remove(actor);
        return Collections.unmodifiableSet(copy);
    }

    List<CommentView> views(List<TaskComment> list) {
        if (list.isEmpty()) return List.of();
        Map<UUID, List<UUID>> mentionsByComment = new HashMap<>();
        for (TaskCommentMention m : mentions.findByCommentIds(list.stream().map(TaskComment::getId).toList())) {
            mentionsByComment.computeIfAbsent(m.getCommentId(), k -> new ArrayList<>()).add(m.getUserId());
        }
        Set<UUID> userIds = new HashSet<>();
        list.forEach(c -> userIds.add(c.getAuthorId()));
        mentionsByComment.values().forEach(userIds::addAll);
        Map<UUID, UserAccounts.AuthenticatedUser> names = users.findActiveByIds(userIds);
        Function<UUID, String> nameOf = id -> names.get(id) == null ? null : names.get(id).nickname();
        return list.stream().map(c -> new CommentView(c.getId(), c.getTaskId(), c.getAuthorId(),
                nameOf.apply(c.getAuthorId()), c.isDeleted() ? null : c.getBody(), c.isDeleted(), c.getCreatedAt(),
                c.getEditedAt(), c.isDeleted() ? List.<PersonRef>of()
                : mentionsByComment.getOrDefault(c.getId(), List.of()).stream()
                .map(id -> new PersonRef(id, nameOf.apply(id))).toList())).toList();
    }
}
