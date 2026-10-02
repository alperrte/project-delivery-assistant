package com.pda.task.application;

import com.pda.shared.ImageSniffer;
import com.pda.task.domain.TaskValidationException;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

/**
 * What may be stored as a task attachment. The type is derived from the file extension against a fixed allow-list and
 * then proven by the content itself; the client-supplied content type is never trusted or stored.
 */
final class AttachmentPolicy {
    /** Accepted file, with the content type it will be served as. */
    record Accepted(String fileName, String contentType, boolean inlineSafe) {}

    private record Kind(String contentType, boolean inlineSafe, boolean text) {}

    private static final Map<String, Kind> KINDS = Map.ofEntries(
            Map.entry("png", new Kind("image/png", true, false)),
            Map.entry("jpg", new Kind("image/jpeg", true, false)),
            Map.entry("jpeg", new Kind("image/jpeg", true, false)),
            Map.entry("webp", new Kind("image/webp", true, false)),
            Map.entry("gif", new Kind("image/gif", true, false)),
            Map.entry("pdf", new Kind("application/pdf", false, false)),
            Map.entry("txt", new Kind("text/plain", false, true)),
            Map.entry("csv", new Kind("text/csv", false, true)),
            Map.entry("md", new Kind("text/markdown", false, true)),
            Map.entry("zip", new Kind("application/zip", false, false)),
            Map.entry("docx", new Kind("application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    false, false)),
            Map.entry("xlsx", new Kind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    false, false)),
            Map.entry("pptx", new Kind("application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    false, false)));

    private static final int MAX_NAME = 200;

    private AttachmentPolicy() {}

    static Accepted check(String originalName, byte[] bytes) {
        String name = sanitizeName(originalName);
        int dot = name.lastIndexOf('.');
        String extension = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
        Kind kind = KINDS.get(extension);
        if (kind == null || !matches(extension, kind, bytes)) {
            throw new TaskValidationException("TASK_ATTACHMENT_TYPE", "File type is not allowed");
        }
        return new Accepted(name, kind.contentType(), kind.inlineSafe());
    }

    /** Last path segment only, no control or path-hostile characters, bounded length with the extension kept. */
    static String sanitizeName(String original) {
        String name = original == null ? "" : original;
        name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
        StringBuilder clean = new StringBuilder();
        name.codePoints().forEach(cp -> {
            if (Character.isISOControl(cp) || "\"<>:|?*".indexOf(cp) >= 0) clean.append('_');
            else clean.appendCodePoint(cp);
        });
        name = clean.toString().strip();
        while (name.startsWith(".")) name = name.substring(1);
        if (name.length() > MAX_NAME) {
            int dot = name.lastIndexOf('.');
            String extension = dot > 0 && name.length() - dot <= 10 ? name.substring(dot) : "";
            name = name.substring(0, MAX_NAME - extension.length()) + extension;
        }
        if (name.isBlank()) throw new TaskValidationException("TASK_ATTACHMENT_INVALID", "Invalid file name");
        return name;
    }

    private static boolean matches(String extension, Kind kind, byte[] b) {
        if (kind.text()) return plainText(b);
        return switch (extension) {
            // Pictures are opened by every member's browser, so their size is read from the header as well
            // (a few bytes can claim an enormous image); see ImageSniffer.
            case "png", "jpg", "jpeg", "webp" -> isImage(b, kind.contentType());
            case "gif" -> startsWith(b, 'G', 'I', 'F', '8') && b.length > 9 && (b[4] == '7' || b[4] == '9')
                    && b[5] == 'a' && gifSizeAllowed(b);
            case "pdf" -> startsWith(b, '%', 'P', 'D', 'F', '-');
            default -> startsWith(b, 'P', 'K', 0x03, 0x04);
        };
    }

    private static boolean isImage(byte[] bytes, String contentType) {
        try {
            return ImageSniffer.inspect(bytes).contentType().equals(contentType);
        } catch (ImageSniffer.RejectedImageException rejected) {
            if (rejected.reason() == ImageSniffer.Reason.DIMENSIONS) {
                throw new TaskValidationException("TASK_ATTACHMENT_INVALID", "Image dimensions are too large");
            }
            return false;
        }
    }

    /** The logical screen size sits at bytes 6-9 (little endian). */
    private static boolean gifSizeAllowed(byte[] b) {
        long width = (b[6] & 0xFF) | ((b[7] & 0xFF) << 8);
        long height = (b[8] & 0xFF) | ((b[9] & 0xFF) << 8);
        if (width == 0 || height == 0) return false;
        if (width > ImageSniffer.MAX_SIDE || height > ImageSniffer.MAX_SIDE || width * height > ImageSniffer.MAX_PIXELS) {
            throw new TaskValidationException("TASK_ATTACHMENT_INVALID", "Image dimensions are too large");
        }
        return true;
    }

    private static boolean startsWith(byte[] bytes, int... prefix) {
        if (bytes.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if ((bytes[i] & 0xFF) != prefix[i]) return false;
        }
        return true;
    }

    /** Valid UTF-8 without NUL bytes that does not open like markup (HTML/SVG/XML dressed up as text). */
    private static boolean plainText(byte[] bytes) {
        String text;
        try {
            text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            return false;
        }
        if (text.indexOf('\0') >= 0) return false;
        String head = text.substring(0, Math.min(text.length(), 512)).stripLeading();
        if (head.startsWith("﻿")) head = head.substring(1).stripLeading();
        String lower = head.toLowerCase(Locale.ROOT);
        return !(lower.startsWith("<!doctype") || lower.startsWith("<html") || lower.startsWith("<svg")
                || lower.startsWith("<?xml") || lower.startsWith("<script") || lower.startsWith("<body"));
    }
}
