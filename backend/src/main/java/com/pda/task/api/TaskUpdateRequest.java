package com.pda.task.api;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.pda.task.application.TaskCommand;
import com.pda.task.domain.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/** Basic fields are replaced; omitted advanced fields are retained, explicit null clears them. */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY)
public class TaskUpdateRequest {
    @NotBlank @Size(max = 160) private String title;
    @Size(max = 10000) private String description;
    @NotNull private TaskPriority priority;
    private LocalDate startDate;
    private Instant deadlineAt;
    private Integer estimatePoints;
    private Integer timeEstimateMinutes;
    @Size(max = 20) private List<@NotNull UUID> assigneeIds;
    @Size(max = 10) private List<@NotNull UUID> labelIds;
    private UUID parentTaskId;
    private UUID sprintId;
    @Valid private TaskController.PoolBody pool;
    private TaskCreationMode creationMode;
    @JsonIgnore private final Set<String> providedFields = new HashSet<>();

    @JsonSetter public void setEstimatePoints(Integer value) { estimatePoints = value; providedFields.add("estimatePoints"); }
    @JsonSetter public void setTimeEstimateMinutes(Integer value) { timeEstimateMinutes = value; providedFields.add("timeEstimateMinutes"); }
    @JsonSetter public void setParentTaskId(UUID value) { parentTaskId = value; providedFields.add("parentTaskId"); }
    @JsonSetter public void setSprintId(UUID value) { sprintId = value; providedFields.add("sprintId"); }

    TaskCommand toCommand() {
        return new TaskCommand(new TaskDraft(title, description, priority, startDate, deadlineAt,
                estimatePoints, timeEstimateMinutes), asSet(assigneeIds), asSet(labelIds), parentTaskId,
                sprintId, pool == null ? null : new TaskCommand.PoolRequest(pool.open(), pool.teamId()),
                creationMode, Set.copyOf(providedFields));
    }

    private static Set<UUID> asSet(List<UUID> values) { return values == null ? null : new HashSet<>(values); }
}
