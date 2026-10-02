package com.pda.project.application.service;

/** A rejected logo upload; {@link #code()} is the stable error code the frontend translates. */
public class ProjectLogoException extends RuntimeException {

    public static final String INVALID_TYPE = "PROJECT_LOGO_INVALID_TYPE";
    public static final String TOO_LARGE = "PROJECT_LOGO_TOO_LARGE";
    public static final String EMPTY = "PROJECT_LOGO_EMPTY";
    public static final String DIMENSIONS = "PROJECT_LOGO_DIMENSIONS";

    private final String code;

    public ProjectLogoException(String code) {
        super(code);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
