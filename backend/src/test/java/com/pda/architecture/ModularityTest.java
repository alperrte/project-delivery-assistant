package com.pda.architecture;

import com.pda.BackendApplication;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTest {

    @Test
    void moduleBoundariesAreValid() {
        ApplicationModules.of(BackendApplication.class).verify();
    }
}
