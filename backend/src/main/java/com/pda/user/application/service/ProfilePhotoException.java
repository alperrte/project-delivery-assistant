package com.pda.user.application.service;

/** A rejected profile photo upload; {@link #code()} is the stable error code the frontend translates. */
public class ProfilePhotoException extends RuntimeException {

    public static final String INVALID_TYPE = "PROFILE_PHOTO_INVALID_TYPE";
    public static final String TOO_LARGE = "PROFILE_PHOTO_TOO_LARGE";
    public static final String EMPTY = "PROFILE_PHOTO_EMPTY";
    public static final String DIMENSIONS = "PROFILE_PHOTO_DIMENSIONS";

    private final String code;

    public ProfilePhotoException(String code) {
        super(code);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
