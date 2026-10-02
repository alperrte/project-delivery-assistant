package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;

import java.util.List;
import java.util.UUID;

/**
 * A project plus everything the project card shows, aggregated for a whole page of projects. {@code canEdit} says
 * whether the requesting user may change the project's settings (the pencil on the card); it is a hint for the UI,
 * the settings endpoints still check the permission themselves.
 */
public record ProjectCardView(Project project, int memberCount, List<Person> preview, Person updatedBy,
                              boolean canEdit) {

    public record Person(UUID userId, String nickname, Long profilePhotoVersion) {
    }
}
