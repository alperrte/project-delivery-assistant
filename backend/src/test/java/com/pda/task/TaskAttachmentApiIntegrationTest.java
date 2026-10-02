package com.pda.task;

import com.jayway.jsonpath.JsonPath;
import com.pda.shared.TestImages;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** The attachment surface: content is proven by magic bytes, never by the name or the client's content type. */
class TaskAttachmentApiIntegrationTest extends TaskTestBase {
    private static final byte[] PNG = TestImages.png(2, 2);

    @org.springframework.beans.factory.annotation.Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    private static MockMultipartFile file(String name, String declaredType, byte[] bytes) {
        return new MockMultipartFile("file", name, declaredType, bytes);
    }

    private UUID upload(String base, Account who, MockMultipartFile file) throws Exception {
        String body = send(multipart(base + "/attachments").file(file), who, null).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    @Test void anAttachmentIsOnlyReachableThroughItsOwnTaskAndProject() throws Exception {
        Account pm = account("attscopepm");
        UUID projectA = project(pm, "Attachment scope A");
        UUID projectB = project(pm, "Attachment scope B");
        UUID taskA = createTask(projectA, pm, "{\"title\":\"Task A\"}");
        UUID taskA2 = createTask(projectA, pm, "{\"title\":\"Second task of A\"}");
        UUID taskB = createTask(projectB, pm, "{\"title\":\"Task B\"}");
        String baseA = tasksUrl(projectA) + "/" + taskA;
        UUID attachment = upload(baseA, pm, file("a.png", "image/png", PNG));

        // Another task of the same project, and a task of another project the same person manages: both 404.
        for (String wrongBase : new String[] {tasksUrl(projectA) + "/" + taskA2, tasksUrl(projectB) + "/" + taskB,
                tasksUrl(projectB) + "/" + taskA}) {
            read(wrongBase + "/attachments/" + attachment + "/content", pm).andExpect(status().isNotFound());
            send(delete(wrongBase + "/attachments/" + attachment), pm, null).andExpect(status().isNotFound());
        }
        // The attachment was not touched by any of that.
        read(baseA + "/attachments/" + attachment + "/content", pm).andExpect(status().isOk()).andExpect(content().bytes(PNG));
    }

    @Test void validUploadIsServedSafelyAndPermissionsHold() throws Exception {
        Account pm = account("attpm");
        UUID project = project(pm, "Attachment project");
        Account member = member(project, pm, "attm");
        Account other = member(project, pm, "atto");
        Account outsider = account("attoutsider");
        UUID task = createTask(project, pm, "{\"title\":\"With files\"}");
        String base = tasksUrl(project) + "/" + task;

        UUID image = upload(base, member, file("../../evil\\shot?.png", "text/html", PNG));
        read(base + "/attachments", other).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].fileName").value("shot_.png"))
                .andExpect(jsonPath("$[0].contentType").value("image/png"));
        read(base, other).andExpect(jsonPath("$.attachmentCount").value(1));
        read(base + "/attachments/" + image + "/content", other).andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Security-Policy", "sandbox"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("private")))
                .andExpect(content().bytes(PNG));

        UUID text = upload(base, member, file("notes.txt", "application/octet-stream",
                "plain notes".getBytes(StandardCharsets.UTF_8)));
        read(base + "/attachments/" + text + "/content", pm)
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")));

        read(base + "/attachments/" + image + "/content", outsider).andExpect(deniedToOutsider());
        send(multipart(base + "/attachments").file(file("a.png", "image/png", PNG)), outsider, null)
                .andExpect(deniedToOutsider());
        mvc.perform(multipart(base + "/attachments").file(file("a.png", "image/png", PNG)).cookie(member.access()))
                .andExpect(status().isForbidden());
        mvc.perform(get(base + "/attachments")).andExpect(status().isUnauthorized());

        send(delete(base + "/attachments/" + image), other, null).andExpect(status().isForbidden());
        send(delete(base + "/attachments/" + image), member, null).andExpect(status().isNoContent());
        send(delete(base + "/attachments/" + text), pm, null).andExpect(status().isNoContent());
        read(base + "/attachments/" + image + "/content", pm).andExpect(status().isNotFound());
        read(base, pm).andExpect(jsonPath("$.attachmentCount").value(0));
        // A deleted attachment keeps no bytes behind.
        org.junit.jupiter.api.Assertions.assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM task_attachment_data WHERE attachment_id IN (?, ?)", Integer.class, image, text));
    }

    @Test void disguisedActiveAndOversizedFilesAreRefused() throws Exception {
        Account pm = account("attbadpm");
        UUID project = project(pm, "Attachment reject project");
        UUID task = createTask(project, pm, "{\"title\":\"Hostile files\"}");
        String url = tasksUrl(project) + "/" + task + "/attachments";

        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile[] rejected = {
                file("fake.png", "image/png", "not really a png".getBytes(StandardCharsets.UTF_8)),
                file("fake.pdf", "application/pdf", PNG),
                file("page.html", "text/html", html),
                file("image.svg", "image/svg+xml", svg),
                file("notes.txt", "text/plain", html),
                file("vector.txt", "text/plain", svg),
                file("binary.txt", "text/plain", new byte[]{'a', 0, 'b'}),
                file("run.exe", "application/octet-stream", new byte[]{'M', 'Z', 0, 0}),
                file("noextension", "image/png", PNG),
        };
        for (MockMultipartFile bad : rejected) {
            send(multipart(url).file(bad), pm, null).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("TASK_ATTACHMENT_TYPE"));
        }
        send(multipart(url).file(file("empty.png", "image/png", new byte[0])), pm, null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("TASK_ATTACHMENT_INVALID"));

        // A few bytes that claim an enormous picture are refused before anyone's browser is asked to draw it.
        byte[] gifBomb = {'G', 'I', 'F', '8', '9', 'a', (byte) 0xFF, (byte) 0xFF, (byte) 0xFF, (byte) 0xFF, 0, 0};
        for (MockMultipartFile bomb : new MockMultipartFile[] {
                file("bomb.png", "image/png", TestImages.pngHeaderClaiming(10_000, 10_000)),
                file("bomb.gif", "image/gif", gifBomb)}) {
            send(multipart(url).file(bomb), pm, null).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("TASK_ATTACHMENT_INVALID"));
        }

        byte[] huge = TestImages.pngPaddedTo(10 * 1024 * 1024 + 1);
        send(multipart(url).file(file("huge.png", "image/png", huge)), pm, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASK_ATTACHMENT_TOO_LARGE"));
        read(url, pm).andExpect(jsonPath("$.length()").value(0));
    }

    @Test void aTaskHoldsAtMostTwentyFiles() throws Exception {
        Account pm = account("attlimitpm");
        UUID project = project(pm, "Attachment limit project");
        UUID task = createTask(project, pm, "{\"title\":\"Crowded\"}");
        String base = tasksUrl(project) + "/" + task;
        UUID last = null;
        for (int i = 0; i < 20; i++) last = upload(base, pm, file("shot" + i + ".png", "image/png", PNG));
        send(multipart(base + "/attachments").file(file("one-more.png", "image/png", PNG)), pm, null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TASK_ATTACHMENT_LIMIT"));
        send(delete(base + "/attachments/" + last), pm, null).andExpect(status().isNoContent());
        upload(base, pm, file("fits-again.png", "image/png", PNG));
    }
}
