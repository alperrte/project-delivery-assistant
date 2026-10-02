package com.pda.shared;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.util.Base64;

/** Real, valid (and deliberately hostile) image bytes for the upload tests. */
public final class TestImages {

    /** A valid 1x1 lossless WebP. */
    private static final byte[] WEBP_1X1 = Base64.getDecoder().decode("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==");

    private TestImages() {
    }

    public static byte[] png(int width, int height) {
        return encode(width, height, "png");
    }

    public static byte[] jpeg(int width, int height) {
        return encode(width, height, "jpg");
    }

    public static byte[] webp() {
        return WEBP_1X1.clone();
    }

    /** A valid PNG followed by zeros up to exactly {@code total} bytes (decoders ignore trailing data). */
    public static byte[] pngPaddedTo(int total) {
        byte[] png = png(2, 2);
        byte[] padded = new byte[total];
        System.arraycopy(png, 0, padded, 0, png.length);
        return padded;
    }

    /**
     * Only the PNG signature and a header that claims the given size: a few dozen bytes that would be an enormous
     * image if anything tried to decode it. This is exactly what an upload bomb looks like.
     */
    public static byte[] pngHeaderClaiming(int width, int height) {
        ByteBuffer buffer = ByteBuffer.allocate(33);
        buffer.put(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A});
        buffer.putInt(13).put(new byte[] {'I', 'H', 'D', 'R'}).putInt(width).putInt(height);
        buffer.put(new byte[] {8, 2, 0, 0, 0}).putInt(0);
        return buffer.array();
    }

    private static byte[] encode(int width, int height, String format) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, format, out);
            return out.toByteArray();
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
