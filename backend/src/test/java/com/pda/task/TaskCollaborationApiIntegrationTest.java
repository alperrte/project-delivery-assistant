package com.pda.task;

import com.jayway.jsonpath.JsonPath;
import com.pda.notification.application.NotificationService;
import com.pda.notification.domain.NotificationType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Comments, mentions, watchers, timeline, relations, checklist, labels, subtasks and the permission matrix. */
class TaskCollaborationApiIntegrationTest extends TaskTestBase {
    @Autowired NotificationService notifications;

    private long count(Account who, NotificationType type) {
        return notifications.list(who.id(), false, type, 0, 100).getTotalElements();
    }

    private UUID idOf(String body) { return UUID.fromString(JsonPath.read(body, "$.id")); }

    @Test void peopleInTasksAndCommentsCarryOnlyTheirPhotoVersionAndOnlyWhenTheyHaveAPhoto() throws Exception {
        Account pm = account("photopm");
        UUID project = project(pm, "Photo project");
        Account withPhoto = member(project, pm, "photoa");
        Account withoutPhoto = member(project, pm, "photob");
        send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart(
                        org.springframework.http.HttpMethod.PUT, "/api/v1/users/me/profile-photo")
                .file(new org.springframework.mock.web.MockMultipartFile("file", "me.png", "image/png",
                        com.pda.shared.TestImages.png(2, 2))), withPhoto, null).andExpect(status().isOk());
        UUID task = createTask(project, pm, "{\"title\":\"With faces\",\"assigneeIds\":[\"" + withPhoto.id()
                + "\",\"" + withoutPhoto.id() + "\"]}");
        String base = tasksUrl(project) + "/" + task;
        send(post(base + "/comments"), withPhoto, "{\"body\":\"Mine @[" + withoutPhoto.id() + "]\"}")
                .andExpect(status().isCreated());
        send(put(base + "/watch"), withPhoto, null).andExpect(status().isOk());

        String assignees = read(base, pm).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        java.util.List<Object> versions = com.jayway.jsonpath.JsonPath.read(assignees,
                "$.assignees[?(@.userId=='" + withPhoto.id() + "')].profilePhotoVersion");
        assertEquals(1, versions.size());
        org.junit.jupiter.api.Assertions.assertNotNull(versions.get(0), "an assignee with a photo has a version");
        read(base, pm).andExpect(jsonPath("$.assignees[?(@.userId=='" + withoutPhoto.id() + "')].profilePhotoVersion")
                .value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())));
        read(base + "/comments", pm).andExpect(jsonPath("$.content[0].authorPhotoVersion").isNumber())
                .andExpect(jsonPath("$.content[0].mentions[0].profilePhotoVersion")
                        .value(org.hamcrest.Matchers.nullValue()));
        read(base + "/watchers", pm).andExpect(jsonPath("$[?(@.userId=='" + withPhoto.id() + "')].profilePhotoVersion")
                .value(org.hamcrest.Matchers.hasSize(1)));
    }

    @Test void commentsMentionsWatchersAndTimeline() throws Exception {
        Account pm = account("collabpm");
        UUID project = project(pm, "Collab project");
        Account a = member(project, pm, "collaba");
        Account b = member(project, pm, "collabb");
        Account outsider = account("collaboutsider");
        UUID task = createTask(project, pm, "{\"title\":\"Discuss\",\"assigneeIds\":[\"" + a.id() + "\"]}");
        String base = tasksUrl(project) + "/" + task;

        String created = send(post(base + "/comments"), b, "{\"body\":\"Hello @[" + a.id() + "] and @["
                + outsider.id() + "]\"}").andExpect(status().isCreated())
                .andExpect(jsonPath("$.mentions.length()").value(1)).andReturn().getResponse().getContentAsString();
        UUID comment = idOf(created);
        assertEquals(1, count(a, NotificationType.TASK_MENTIONED));
        assertEquals(0, count(outsider, NotificationType.TASK_MENTIONED), "a non-member is never notified");
        assertEquals(0, count(b, NotificationType.TASK_COMMENTED), "the author is never notified");
        read(base + "/watchers", pm).andExpect(status().isOk());
        read(base, b).andExpect(jsonPath("$.watching").value(true)).andExpect(jsonPath("$.commentCount").value(1));

        StringBuilder tooMany = new StringBuilder("x");
        for (int i = 0; i < 21; i++) tooMany.append(" @[").append(UUID.randomUUID()).append("]");
        send(post(base + "/comments"), b, "{\"body\":\"" + tooMany + "\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASK_TOO_MANY_MENTIONS"));
        send(post(base + "/comments"), b, "{\"body\":\"  \"}").andExpect(status().isBadRequest());

        send(patch(base + "/comments/" + comment), a, "{\"body\":\"hijack\"}").andExpect(status().isForbidden());
        send(patch(base + "/comments/" + comment), b, "{\"body\":\"Edited\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("Edited"));
        read(base + "/activity?filter=COMMENTS", a).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].kind").value("COMMENT"));
        read(base + "/activity?filter=EVENTS", a).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].kind").value("EVENT"));
        read(base + "/activity?filter=NOPE", a).andExpect(status().isBadRequest());

        send(delete(base + "/comments/" + comment), a, null).andExpect(status().isForbidden());
        send(delete(base + "/comments/" + comment), pm, null).andExpect(status().isNoContent());
        read(base + "/comments", a).andExpect(jsonPath("$.content[0].deleted").value(true))
                .andExpect(jsonPath("$.content[0].body").doesNotExist());
        send(patch(base + "/comments/" + comment), b, "{\"body\":\"again\"}").andExpect(status().isNotFound());

        // A page number so large that page * size overflows an int is just an empty page, not a server error.
        read(base + "/comments?page=2147483647&size=100", a).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
        read(base + "/activity?page=2147483647&size=100", a).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));

        send(put(base + "/watch"), outsider, null).andExpect(deniedToOutsider());
        send(delete(base + "/watch"), b, null).andExpect(status().isOk()).andExpect(jsonPath("$.watching").value(false));
        send(put(base + "/watch"), b, null).andExpect(status().isOk()).andExpect(jsonPath("$.watching").value(true));
        send(put(base + "/watch"), b, null).andExpect(status().isOk());
        read(base + "/watchers", pm).andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)));
    }

    @Test void relationsRejectSelfDuplicatesAndBlockingLoops() throws Exception {
        Account pm = account("relpm");
        UUID project = project(pm, "Relation project");
        Account a = member(project, pm, "rela");
        Account unrelated = member(project, pm, "relb");
        UUID one = createTask(project, pm, "{\"title\":\"One\",\"assigneeIds\":[\"" + a.id() + "\"]}");
        UUID two = createTask(project, pm, "{\"title\":\"Two\"}");
        UUID three = createTask(project, pm, "{\"title\":\"Three\"}");
        UUID otherProject = createTask(project(pm, "Relation other project"), pm, "{\"title\":\"Elsewhere\"}");
        String url = tasksUrl(project) + "/" + one + "/relations";

        send(post(url), pm, "{\"type\":\"BLOCKS\",\"targetTaskId\":\"" + one + "\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASK_RELATION_INVALID"));
        send(post(url), pm, "{\"type\":\"BLOCKS\",\"targetTaskId\":\"" + otherProject + "\"}")
                .andExpect(status().isNotFound());
        send(post(url), unrelated, "{\"type\":\"BLOCKS\",\"targetTaskId\":\"" + two + "\"}")
                .andExpect(status().isForbidden());
        send(post(url), a, "{\"type\":\"BLOCKS\",\"targetTaskId\":\"" + two + "\"}").andExpect(status().isCreated())
                .andExpect(jsonPath("$.blocks.length()").value(1));
        send(post(url), pm, "{\"type\":\"BLOCKS\",\"targetTaskId\":\"" + two + "\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_RELATION_EXISTS"));
        send(post(tasksUrl(project) + "/" + two + "/relations"), pm,
                "{\"type\":\"BLOCKS\",\"targetTaskId\":\"" + three + "\"}").andExpect(status().isCreated());
        send(post(tasksUrl(project) + "/" + three + "/relations"), pm,
                "{\"type\":\"BLOCKS\",\"targetTaskId\":\"" + one + "\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_RELATION_CYCLE"));
        send(post(url), pm, "{\"type\":\"RELATES\",\"targetTaskId\":\"" + three + "\"}").andExpect(status().isCreated());
        send(post(tasksUrl(project) + "/" + three + "/relations"), pm,
                "{\"type\":\"RELATES\",\"targetTaskId\":\"" + one + "\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_RELATION_EXISTS"));

        read(tasksUrl(project) + "/" + two, pm).andExpect(jsonPath("$.hasOpenBlockers").value(true));
        String view = read(url, pm).andExpect(jsonPath("$.blocks[0].taskId").value(two.toString()))
                .andReturn().getResponse().getContentAsString();
        UUID relation = UUID.fromString(JsonPath.read(view, "$.blocks[0].relationId"));
        send(delete(url + "/" + relation), unrelated, null).andExpect(status().isForbidden());
        send(delete(url + "/" + relation), a, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks.length()").value(0));
        send(delete(url + "/" + relation), a, null).andExpect(status().isNotFound());
    }

    @Test void checklistLabelsAndSubtasks() throws Exception {
        Account pm = account("structpm");
        UUID project = project(pm, "Structure project");
        Account a = member(project, pm, "structa");
        Account b = member(project, pm, "structb");
        UUID task = createTask(project, pm, "{\"title\":\"Parent\",\"assigneeIds\":[\"" + a.id() + "\"]}");
        String base = tasksUrl(project) + "/" + task;

        UUID first = idOf(send(post(base + "/checklist"), a, "{\"text\":\"First\"}").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        UUID second = idOf(send(post(base + "/checklist"), pm, "{\"text\":\"Second\"}").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        send(post(base + "/checklist"), b, "{\"text\":\"Nope\"}").andExpect(status().isForbidden());
        send(post(base + "/checklist"), a, "{\"text\":\" \"}").andExpect(status().isBadRequest());
        send(patch(base + "/checklist/" + first), a, "{\"done\":true}").andExpect(status().isOk())
                .andExpect(jsonPath("$.done").value(true));
        send(patch(base + "/checklist/" + first), a, "{}").andExpect(status().isBadRequest());
        send(put(base + "/checklist/order"), a, "{\"itemIds\":[\"" + second + "\",\"" + first + "\"]}")
                .andExpect(status().isOk());
        send(put(base + "/checklist/order"), a, "{\"itemIds\":[\"" + second + "\"]}").andExpect(status().isBadRequest());
        read(base + "/checklist", b).andExpect(jsonPath("$[0].id").value(second.toString()));
        read(base, b).andExpect(jsonPath("$.checklistTotal").value(2)).andExpect(jsonPath("$.checklistDone").value(1));
        send(delete(base + "/checklist/" + second), b, null).andExpect(status().isForbidden());
        send(delete(base + "/checklist/" + second), a, null).andExpect(status().isNoContent());

        send(post("/api/v1/projects/" + project + "/labels"), pm, "{\"name\":\"Bug\",\"color\":\"red\"}")
                .andExpect(status().isCreated());
        send(post("/api/v1/projects/" + project + "/labels"), pm, "{\"name\":\"bug\",\"color\":\"blue\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LABEL_NAME_EXISTS"));
        send(post("/api/v1/projects/" + project + "/labels"), pm, "{\"name\":\"Hex\",\"color\":\"#ff0000\"}")
                .andExpect(status().isBadRequest());
        send(post("/api/v1/projects/" + project + "/labels"), a, "{\"name\":\"Mine\",\"color\":\"blue\"}")
                .andExpect(status().isForbidden());
        UUID label = idOf(send(post("/api/v1/projects/" + project + "/labels"), pm,
                "{\"name\":\"Feature\",\"color\":\"green\"}").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        send(put(base + "/labels"), pm, "{\"labelIds\":[\"" + label + "\"]}").andExpect(status().isOk())
                .andExpect(jsonPath("$.labels[0].name").value("Feature"));
        send(put(base + "/labels"), a, "{\"labelIds\":[]}").andExpect(status().isForbidden());
        send(put(base + "/labels"), pm, "{\"labelIds\":[\"" + UUID.randomUUID() + "\"]}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("TASK_LABEL_INVALID"));
        read(tasksUrl(project) + "?labelId=" + label, b).andExpect(jsonPath("$.totalElements").value(1));
        read("/api/v1/projects/" + project + "/labels", b).andExpect(jsonPath("$[?(@.name=='Feature')].usageCount")
                .value(1));

        UUID child = createTask(project, pm, "{\"title\":\"Child\",\"parentTaskId\":\"" + task + "\"}");
        send(post(tasksUrl(project)), pm, "{\"title\":\"Grandchild\",\"parentTaskId\":\"" + child + "\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("TASK_INVALID_PARENT"));
        send(patch(base), pm, "{\"title\":\"Parent\",\"priority\":\"MEDIUM\",\"parentTaskId\":\"" + child + "\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("TASK_INVALID_PARENT"));
        read(base + "/subtasks", b).andExpect(jsonPath("$.length()").value(1));
        read(base, b).andExpect(jsonPath("$.subtaskCount").value(1));
        read(tasksUrl(project) + "/" + child, b).andExpect(jsonPath("$.parent.id").value(task.toString()));
        send(delete(base), pm, null).andExpect(status().isNoContent());
        read(tasksUrl(project) + "/" + child, pm).andExpect(status().isNotFound());
    }

    @Test void authenticationCsrfIsolationAndArchivedProject() throws Exception {
        Account pm = account("guardpm");
        UUID project = project(pm, "Guard project");
        Account a = member(project, pm, "guarda");
        Account outsider = account("guardoutsider");
        UUID other = project(account("guardother"), "Guard other project");
        UUID task = createTask(project, pm, "{\"title\":\"Guarded\",\"assigneeIds\":[\"" + a.id() + "\"]}");
        String base = tasksUrl(project) + "/" + task;

        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(get(base + "/comments")).andExpect(status().isUnauthorized());
        mvc.perform(post(base + "/comments").cookie(a.access()).contentType("application/json")
                .content("{\"body\":\"no csrf\"}")).andExpect(status().isForbidden());
        for (String path : new String[]{"", "/comments", "/activity", "/checklist", "/relations", "/watchers",
                "/subtasks", "/history"}) {
            read(base + path, outsider).andExpect(deniedToOutsider());
        }
        send(post(base + "/comments"), outsider, "{\"body\":\"hi\"}").andExpect(deniedToOutsider());
        read(tasksUrl(other) + "/" + task, pm).andExpect(deniedToOutsider());
        UUID elsewhere = createTask(project(pm, "Guard second project"), pm, "{\"title\":\"Elsewhere\"}");
        read(base.replace(task.toString(), elsewhere.toString()), pm).andExpect(status().isNotFound());
        send(post(base.replace(task.toString(), elsewhere.toString()) + "/comments"), pm, "{\"body\":\"x\"}")
                .andExpect(status().isNotFound());
        send(post(tasksUrl(project) + "/" + UUID.randomUUID() + "/comments"), a, "{\"body\":\"x\"}")
                .andExpect(status().isNotFound());

        // permission matrix on a status change: PM and assignee yes, unassigned member no
        Account bystander = member(project, pm, "guardc");
        send(patch(base + "/status"), bystander, "{\"status\":\"TODO\"}").andExpect(status().isForbidden());
        send(patch(base + "/status"), a, "{\"status\":\"TODO\"}").andExpect(status().isOk());
        send(patch(base + "/status"), a, "{\"status\":\"DONE\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_INVALID_TRANSITION"));
        send(patch(base), a, "{\"title\":\"Renamed\",\"priority\":\"LOW\"}").andExpect(status().isForbidden());
        send(post(tasksUrl(project)), a, "{\"title\":\"Not allowed\"}").andExpect(status().isForbidden());

        send(post("/api/v1/projects/" + project + "/archive"), pm, null).andExpect(status().isNoContent());
        send(post(base + "/comments"), a, "{\"body\":\"late\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_ARCHIVED"));
        send(post(base + "/comments"), outsider, "{\"body\":\"late\"}").andExpect(deniedToOutsider());
    }
}
