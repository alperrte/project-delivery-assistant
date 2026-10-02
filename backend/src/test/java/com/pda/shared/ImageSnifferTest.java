package com.pda.shared;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ImageSnifferTest {

    private static ImageSniffer.Reason reasonOf(byte[] data) {
        return assertThrows(ImageSniffer.RejectedImageException.class, () -> ImageSniffer.inspect(data)).reason();
    }

    @Test
    void readsTypeAndSizeFromTheBytesOfRealPngJpegAndWebp() throws Exception {
        assertEquals(new ImageSniffer.Image("image/png", 7, 5), ImageSniffer.inspect(TestImages.png(7, 5)));
        assertEquals(new ImageSniffer.Image("image/jpeg", 9, 3), ImageSniffer.inspect(TestImages.jpeg(9, 3)));
        assertEquals(new ImageSniffer.Image("image/webp", 1, 1), ImageSniffer.inspect(TestImages.webp()));
    }

    @Test
    void refusesWhatIsNotAnAllowedImageWhateverItIsCalled() {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes(StandardCharsets.UTF_8);
        for (byte[] data : new byte[][] {svg, "GIF89a".getBytes(StandardCharsets.UTF_8), "<html></html>".getBytes(StandardCharsets.UTF_8),
                new byte[0], new byte[] {1, 2, 3}, "MZ\u0090\u0000".getBytes(StandardCharsets.ISO_8859_1)}) {
            assertEquals(ImageSniffer.Reason.UNSUPPORTED, reasonOf(data));
        }
    }

    @Test
    void refusesHeadersThatLookLikeAnImageButCannotBeRead() {
        // PNG signature without an IHDR, a JPEG that ends before any frame header, a WebP cut off after RIFF.
        byte[] pngNoHeader = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        byte[] jpegNoFrame = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xD9, 0, 0};
        byte[] webpCut = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};
        for (byte[] data : new byte[][] {pngNoHeader, jpegNoFrame, webpCut}) {
            assertEquals(ImageSniffer.Reason.UNSUPPORTED, reasonOf(data));
        }
    }

    @Test
    void refusesAnEnormousImageFromItsHeaderAloneBeforeAnythingIsDecoded() {
        // 10000 x 10000 claimed by 33 bytes: a decompression bomb in miniature.
        assertEquals(ImageSniffer.Reason.DIMENSIONS, reasonOf(TestImages.pngHeaderClaiming(10_000, 10_000)));
        assertEquals(ImageSniffer.Reason.DIMENSIONS, reasonOf(TestImages.pngHeaderClaiming(ImageSniffer.MAX_SIDE + 1, 10)));
        // Each side within the limit, but too many pixels together.
        assertEquals(ImageSniffer.Reason.DIMENSIONS, reasonOf(TestImages.pngHeaderClaiming(5000, 5000)));
        // A claimed size of zero is not an image either.
        assertEquals(ImageSniffer.Reason.UNSUPPORTED, reasonOf(TestImages.pngHeaderClaiming(0, 10)));
    }

    @Test
    void acceptsAnImageExactlyAtTheLimits() throws Exception {
        assertEquals(6000, ImageSniffer.inspect(TestImages.pngHeaderClaiming(6000, 4000)).width());
    }
}
