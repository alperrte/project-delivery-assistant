package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;

import java.util.List;
import java.util.UUID;

/** A project plus everything the project card shows, aggregated for a whole page of projects. */
public record ProjectCardView(Project project, int memberCount, List<Person> preview, Person updatedBy) {

    public record Person(UUID userId, String nickname) {
    }
}
