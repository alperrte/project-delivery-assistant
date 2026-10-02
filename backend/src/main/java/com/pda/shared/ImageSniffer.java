package com.pda.shared;

/**
 * Inspects an uploaded image without decoding it: the type comes from the file's magic bytes (never from the client's
 * file name or content type) and the dimensions come from the header, so a small file that claims to be enormous is
 * refused before anything has to allocate memory for its pixels. Only PNG, JPEG and WebP are accepted; SVG, GIF and
 * everything else are rejected (SVG can carry script).
 *
 * <p>It lives in the shared base package so every module that stores images (profile photos, project logos and
 * banners) applies exactly the same rules.
 */
public final class ImageSniffer {

    /** Longest side an accepted image may have, in pixels. */
    public static final int MAX_SIDE = 6000;
    /** Most pixels an accepted image may have (width times height). */
    public static final long MAX_PIXELS = 24_000_000L;

    public record Image(String contentType, int width, int height) {
    }

    public enum Reason {
        /** Not a PNG, JPEG or WebP file, or its header cannot be read. */
        UNSUPPORTED,
        /** A valid image whose pixel dimensions are beyond the limits. */
        DIMENSIONS
    }

    public static final class RejectedImageException extends Exception {

        private final Reason reason;

        RejectedImageException(Reason reason) {
            super(reason.name());
            this.reason = reason;
        }

        public Reason reason() {
            return reason;
        }
    }

    private ImageSniffer() {
    }

    /** Returns the verified image info, or throws with the reason it was refused. */
    public static Image inspect(byte[] data) throws RejectedImageException {
        if (data == null) {
            throw new RejectedImageException(Reason.UNSUPPORTED);
        }
        Image image;
        if (isPng(data)) {
            image = png(data);
        } else if (isJpeg(data)) {
            image = jpeg(data);
        } else if (isWebp(data)) {
            image = webp(data);
        } else {
            throw new RejectedImageException(Reason.UNSUPPORTED);
        }
        if (image.width() <= 0 || image.height() <= 0) {
            throw new RejectedImageException(Reason.UNSUPPORTED);
        }
        if (image.width() > MAX_SIDE || image.height() > MAX_SIDE
                || (long) image.width() * image.height() > MAX_PIXELS) {
            throw new RejectedImageException(Reason.DIMENSIONS);
        }
        return image;
    }

    private static boolean isPng(byte[] d) {
        return d.length >= 8 && (d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G'
                && d[4] == 0x0D && d[5] == 0x0A && d[6] == 0x1A && d[7] == 0x0A;
    }

    private static boolean isJpeg(byte[] d) {
        return d.length >= 3 && (d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8 && (d[2] & 0xFF) == 0xFF;
    }

    private static boolean isWebp(byte[] d) {
        return d.length >= 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
                && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P';
    }

    /** The first chunk of a PNG is always IHDR: length, "IHDR", then width and height as big-endian ints. */
    private static Image png(byte[] d) throws RejectedImageException {
        if (d.length < 24 || d[12] != 'I' || d[13] != 'H' || d[14] != 'D' || d[15] != 'R') {
            throw new RejectedImageException(Reason.UNSUPPORTED);
        }
        return new Image("image/png", bigEndianInt(d, 16), bigEndianInt(d, 20));
    }

    /** Walks the marker segments up to the first start-of-frame, which carries the height and the width. */
    private static Image jpeg(byte[] d) throws RejectedImageException {
        int i = 2;
        while (i + 3 < d.length) {
            if ((d[i] & 0xFF) != 0xFF) {
                throw new RejectedImageException(Reason.UNSUPPORTED);
            }
            int marker = d[i + 1] & 0xFF;
            if (marker == 0xFF) { // fill byte
                i++;
                continue;
            }
            if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { // standalone markers have no length
                i += 2;
                continue;
            }
            if (marker == 0xD9 || marker == 0xDA) { // end of image / start of scan before any frame header
                throw new RejectedImageException(Reason.UNSUPPORTED);
            }
            int length = ((d[i + 2] & 0xFF) << 8) | (d[i + 3] & 0xFF);
            boolean startOfFrame = marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
            if (startOfFrame) {
                if (i + 8 >= d.length) {
                    throw new RejectedImageException(Reason.UNSUPPORTED);
                }
                int height = ((d[i + 5] & 0xFF) << 8) | (d[i + 6] & 0xFF);
                int width = ((d[i + 7] & 0xFF) << 8) | (d[i + 8] & 0xFF);
                return new Image("image/jpeg", width, height);
            }
            if (length < 2) {
                throw new RejectedImageException(Reason.UNSUPPORTED);
            }
            i += 2 + length;
        }
        throw new RejectedImageException(Reason.UNSUPPORTED);
    }

    /** WebP stores its size in the first chunk, in one of three layouts (lossy, lossless, extended). */
    private static Image webp(byte[] d) throws RejectedImageException {
        if (d.length < 30) {
            throw new RejectedImageException(Reason.UNSUPPORTED);
        }
        String chunk = "" + (char) d[12] + (char) d[13] + (char) d[14] + (char) d[15];
        int width;
        int height;
        switch (chunk) {
            case "VP8 " -> {
                if ((d[23] & 0xFF) != 0x9D || d[24] != 0x01 || d[25] != 0x2A) {
                    throw new RejectedImageException(Reason.UNSUPPORTED);
                }
                width = littleEndianShort(d, 26) & 0x3FFF;
                height = littleEndianShort(d, 28) & 0x3FFF;
            }
            case "VP8L" -> {
                if ((d[20] & 0xFF) != 0x2F) {
                    throw new RejectedImageException(Reason.UNSUPPORTED);
                }
                int bits = (d[21] & 0xFF) | ((d[22] & 0xFF) << 8) | ((d[23] & 0xFF) << 16) | ((d[24] & 0xFF) << 24);
                width = (bits & 0x3FFF) + 1;
                height = ((bits >>> 14) & 0x3FFF) + 1;
            }
            case "VP8X" -> {
                width = 1 + ((d[24] & 0xFF) | ((d[25] & 0xFF) << 8) | ((d[26] & 0xFF) << 16));
                height = 1 + ((d[27] & 0xFF) | ((d[28] & 0xFF) << 8) | ((d[29] & 0xFF) << 16));
            }
            default -> throw new RejectedImageException(Reason.UNSUPPORTED);
        }
        return new Image("image/webp", width, height);
    }

    private static int bigEndianInt(byte[] d, int at) {
        return ((d[at] & 0xFF) << 24) | ((d[at + 1] & 0xFF) << 16) | ((d[at + 2] & 0xFF) << 8) | (d[at + 3] & 0xFF);
    }

    private static int littleEndianShort(byte[] d, int at) {
        return (d[at] & 0xFF) | ((d[at + 1] & 0xFF) << 8);
    }
}
