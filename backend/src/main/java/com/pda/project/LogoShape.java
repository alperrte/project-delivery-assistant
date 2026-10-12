package com.pda.project;

/** Presentation only; changing the shape never modifies the stored image. */
public enum LogoShape {
    SQUARE, CIRCLE;

    @com.fasterxml.jackson.annotation.JsonCreator(mode = com.fasterxml.jackson.annotation.JsonCreator.Mode.DELEGATING)
    public static LogoShape fromJson(String value) {
        return value == null ? null : valueOf(value);
    }
}
