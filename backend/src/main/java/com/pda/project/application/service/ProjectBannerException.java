package com.pda.project.application.service;

/** A rejected banner upload; {@link #code()} is the stable error code the frontend translates. */
public class ProjectBannerException extends RuntimeException {

    public static final String INVALID_TYPE = "PROJECT_BANNER_INVALID_TYPE";
    public static final String TOO_LARGE = "PROJECT_BANNER_TOO_LARGE";
    public static final String EMPTY = "PROJECT_BANNER_EMPTY";
    public static final String DIMENSIONS = "PROJECT_BANNER_DIMENSIONS";

    private final String code;

    public ProjectBannerException(String code) {
        super(code);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
