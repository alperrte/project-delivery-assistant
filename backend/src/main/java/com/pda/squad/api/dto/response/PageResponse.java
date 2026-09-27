package com.pda.squad.api.dto.response;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Mirrors {@code com.pda.project.api.dto.response.PageResponse}. Kept as a small local duplicate rather than a
 * cross-module import so Squad, its own Spring Modulith module, depends only on {@code project.ProjectAccess}.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static <S, T> PageResponse<T> from(Page<S> source, Function<S, T> mapper) {
        return new PageResponse<>(source.getContent().stream().map(mapper).toList(),
                source.getNumber(), source.getSize(), source.getTotalElements(),
                source.getTotalPages());
    }
}
