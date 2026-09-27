package com.pda.project.application.service;

import com.pda.project.ProjectOverview;
import com.pda.project.domain.entity.Project;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectOverviewService implements ProjectOverview {

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;

    public ProjectOverviewService(ProjectRepository projects, ProjectMembershipRepository memberships) {
        this.projects = projects;
        this.memberships = memberships;
    }

    @Override
    @Transactional(readOnly = true)
    public ProjectCounts counts() {
        long total = projects.count();
        long active = projects.countByArchivedAtIsNull();
        return new ProjectCounts(total, active, total - active);
    }

    @Override
    @Transactional(readOnly = true)
    public ProjectPage list(int page, int size) {
        var result = projects.findAll(PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"))));
        List<UUID> ids = result.getContent().stream().map(Project::getId).toList();
        Map<UUID, Long> members = new HashMap<>();
        if (!ids.isEmpty()) {
            for (Object[] row : memberships.countActiveByProjectIds(ids)) {
                members.put((UUID) row[0], (Long) row[1]);
            }
        }
        List<ProjectSummary> items = result.getContent().stream()
                .map(project -> new ProjectSummary(project.getId(), project.getName(), project.getSlug(),
                        project.getStatus().name(), project.getArchivedAt() != null,
                        members.getOrDefault(project.getId(), 0L), project.getCreatedAt()))
                .toList();
        return new ProjectPage(items, result.getNumber(), result.getSize(), result.getTotalElements());
    }
}
