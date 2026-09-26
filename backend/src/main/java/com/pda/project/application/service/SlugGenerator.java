package com.pda.project.application.service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

public final class SlugGenerator {

    private static final int MAX_BASE_LENGTH = 91;

    private SlugGenerator() {
    }

    public static String generate(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        String latinName = name.toLowerCase(Locale.ROOT).replace('ı', 'i');
        String base = Normalizer.normalize(latinName, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        if (base.isEmpty()) {
            throw new IllegalArgumentException("name cannot produce a slug");
        }
        if (base.length() > MAX_BASE_LENGTH) {
            base = base.substring(0, MAX_BASE_LENGTH).replaceAll("-+$", "");
        }
        return base + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
