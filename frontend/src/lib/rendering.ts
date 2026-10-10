/**
 * Whether this browser composites the page in software (hardware acceleration switched off, a blocklisted GPU, a
 * remote or virtual display). Measured on /login at 2560x1440: the full-screen `screen`/`multiply` neon group costs
 * about 40 ms per frame there, so the theme switch dropped to ~7 fps; with a GPU it is free. The verdict is written to
 * `<html data-renderer="software">`, which `globals.css` reads to drop the neon.
 *
 * Detection (`RenderingProbe`) asks for a WebGL context with `failIfMajorPerformanceCaveat`: browsers refuse it when
 * they would fall back to a software rasteriser. The verdict is cached per tab in sessionStorage and re-applied before
 * first paint by `RENDERER_BOOT_SCRIPT` (inlined in the root layout), so later pages and reloads never flash.
 */
export const RENDERER_STORAGE_KEY = "pda:renderer";

/** Runs in <head>: re-applies a cached verdict before the first paint. Must stay tiny, dependency-free and silent. */
export const RENDERER_BOOT_SCRIPT = `try{if(sessionStorage.getItem("${RENDERER_STORAGE_KEY}")==="software")document.documentElement.dataset.renderer="software"}catch(e){}`;

// Software rasterisers as ANGLE / the driver names them: SwiftShader (Chrome's fallback), llvmpipe and softpipe (Mesa),
// WARP ("Microsoft Basic Render Driver").
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render|\bwarp\b/i;

/**
 * True when no hardware-accelerated WebGL context can be created. Releases any context it creates straight away.
 *
 * Chrome with hardware acceleration off refuses the `failIfMajorPerformanceCaveat` context (checked in headed Chrome with
 * `--disable-gpu`), but headless Chromium hands out its SwiftShader context anyway, so a context that was granted is
 * still checked against the driver names above.
 */
export function detectSoftwareRendering(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const options = { failIfMajorPerformanceCaveat: true };
    const context = (canvas.getContext("webgl", options) ?? canvas.getContext("webgl2", options)) as WebGLRenderingContext | null;
    if (!context) return true;
    const info = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return SOFTWARE_RENDERER.test(renderer);
  } catch {
    // Detection itself failed: keep the full scene rather than guess.
    return false;
  }
}

export function applyRenderer(software: boolean) {
  if (software) document.documentElement.dataset.renderer = "software";
  else delete document.documentElement.dataset.renderer;
}
