package com.pda.task.api;

import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TaskLockConflictApiTest {
    @RestController static class Probe {
        @PostMapping("/lock-conflict") void write() {
            throw new CannotAcquireLockException("private SQL and storage details");
        }
    }

    @Test void lockConflictReturnsSafeRetryableProblemInsteadOfLeakingDatabaseException() throws Exception {
        MockMvcBuilders.standaloneSetup(new Probe()).setControllerAdvice(new TaskApiErrorHandler()).build()
                .perform(post("/lock-conflict")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_CONFLICT"))
                .andExpect(jsonPath("$.detail").value("Task operation conflicts with current state"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private SQL"))));
    }
}
