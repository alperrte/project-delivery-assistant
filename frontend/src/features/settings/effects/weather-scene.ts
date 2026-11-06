import type { AnimationPreset } from "../theme-animation";

const TAU = Math.PI * 2;
const random = (min: number, max: number) => min + Math.random() * (max - min);

/** Viewport-bounded layers; optical sprites and atmospheric lighting are rasterized once. */
export function createWeatherScene(ctx: CanvasRenderingContext2D, width: number, height: number, preset: AnimationPreset, lightning?: () => void) {
  const mobile = width < 640;
  const rain = preset === "RAIN" || preset === "THUNDERSTORM";
  const particles = Array.from({ length: rain ? (mobile ? 72 : 180) : (mobile ? 48 : 116) }, () => ({
    x: random(0, width), y: random(0, height), depth: random(.15, 1), phase: random(0, TAU),
    radius: random(2, 14), life: random(0, 1),
  }));
  const splashes = Array.from({ length: mobile ? 9 : 22 }, () => ({ x: random(0, width), y: random(height * .65, height), life: random(0, 1) }));
  const backdrop = document.createElement("canvas");
  backdrop.width = Math.max(1, Math.round(width / 2)); backdrop.height = Math.max(1, Math.round(height / 2));
  const light = backdrop.getContext("2d")!;
  light.scale(.5, .5);
  const warm = preset === "FIRE", water = preset === "WATER";
  const wash = light.createRadialGradient(width * .55, warm ? height * 1.12 : -height * .15, 0, width * .5, height * .5, Math.max(width, height));
  wash.addColorStop(0, warm ? "rgba(208,76,25,.19)" : water ? "rgba(56,151,165,.16)" : "rgba(100,133,162,.1)");
  wash.addColorStop(1, "transparent"); light.fillStyle = wash; light.fillRect(0, 0, width, height);
  if (water) for (let i = 0; i < 5; i++) {
    light.filter = "blur(9px)";
    const x = width * (.1 + i * .22);
    const ray = light.createLinearGradient(x, 0, x + width * .1, height);
    ray.addColorStop(0, "rgba(105,185,192,.055)"); ray.addColorStop(1, "transparent");
    light.fillStyle = ray; light.beginPath(); light.moveTo(x, 0); light.lineTo(x + width * .035, 0);
    light.lineTo(x + width * .3, height); light.lineTo(x + width * .1, height); light.fill();
  }
  // Low-resolution advected density gives fire continuous, irregular edges rather than vector triangles.
  const fire = document.createElement("canvas"); fire.width = mobile ? 128 : 256; fire.height = 128;
  const fireContext = fire.getContext("2d")!;
  const pixels = fireContext.createImageData(fire.width, fire.height);
  const noiseTable = Float32Array.from({ length: 4096 }, () => Math.random());
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = noiseTable[(iy & 63) * 64 + (ix & 63)], b = noiseTable[(iy & 63) * 64 + ((ix + 1) & 63)];
    const c = noiseTable[((iy + 1) & 63) * 64 + (ix & 63)], d = noiseTable[((iy + 1) & 63) * 64 + ((ix + 1) & 63)];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
  const bubble = document.createElement("canvas"); bubble.width = bubble.height = 64;
  const b = bubble.getContext("2d")!;
  const lens = b.createRadialGradient(25, 23, 3, 32, 32, 28);
  lens.addColorStop(0, "rgba(130,208,216,.01)"); lens.addColorStop(.8, "rgba(96,175,190,.025)");
  lens.addColorStop(.94, "rgba(132,211,217,.38)"); lens.addColorStop(1, "transparent");
  b.fillStyle = lens; b.fillRect(0, 0, 64, 64);
  b.strokeStyle = "rgba(193,233,235,.6)"; b.lineWidth = 1.3;
  b.beginPath(); b.arc(32, 32, 25, Math.PI * 1.08, Math.PI * 1.52); b.stroke();
  b.fillStyle = "rgba(208,242,244,.65)"; b.beginPath(); b.ellipse(21, 17, 2.4, 1.2, -.6, 0, TAU); b.fill();
  const drop = document.createElement("canvas"); drop.width = 8; drop.height = 96;
  const d = drop.getContext("2d")!, trail = d.createLinearGradient(0, 0, 0, 96);
  trail.addColorStop(0, "transparent"); trail.addColorStop(.75, "rgba(152,187,207,.4)"); trail.addColorStop(1, "rgba(185,215,230,.75)");
  d.fillStyle = trail; d.beginPath(); d.moveTo(4, 0); d.lineTo(5.5, 92); d.quadraticCurveTo(4, 98, 2.5, 92); d.closePath(); d.fill();
  const mist = document.createElement("canvas"); mist.width = 128; mist.height = 64;
  const m = mist.getContext("2d")!, haze = m.createRadialGradient(64, 32, 0, 64, 32, 64);
  haze.addColorStop(0, "rgba(123,156,178,.055)"); haze.addColorStop(1, "transparent"); m.fillStyle = haze; m.fillRect(0, 0, 128, 64);
  let elapsed = 0, nextBolt = random(12, 16), flash = 0;
  let bolt: { x: number; y: number }[] = [];
  const makeBolt = () => {
    let x = random(width * .2, width * .9), y = -10;
    bolt = [{ x, y }];
    for (let i = 0; i < 13; i++) { x += random(-28, 28); y += height * random(.018, .035); bolt.push({ x, y }); }
    flash = .65; nextBolt = elapsed + random(20, 36); lightning?.();
  };
  const draw = (dt: number) => {
    elapsed += dt; ctx.clearRect(0, 0, width, height);
    ctx.drawImage(backdrop, 0, 0, width, height);
    if (warm) {
      for (let y = 0; y < fire.height; y++) for (let x = 0; x < fire.width; x++) {
        const u = x / fire.width, v = y / fire.height, t = elapsed * .7;
        const curl = noise(u * 8, v * 4 + t) * 2;
        const field = noise(u * 24 + curl, v * 2 + t * 2) * .66
          + noise(u * 51 + curl * 2, v * 5 + t * 3) * .25 + noise(u * 100, v * 11 + t * 5) * .09;
        const heat = Math.max(0, v - .72 + field * .95);
        const alpha = Math.min(.55, heat * .8) * Math.min(1, v * 6);
        const core = Math.min(1, Math.max(0, (heat - .28) * 2.4));
        const index = (y * fire.width + x) * 4;
        pixels.data[index] = 203 + core * 50;
        pixels.data[index + 1] = 64 + core * 144;
        pixels.data[index + 2] = 22 + core * 65;
        pixels.data[index + 3] = alpha * 255;
      }
      fireContext.putImageData(pixels, 0, 0);
      const fireHeight = Math.min(height * .42, 340);
      ctx.drawImage(fire, 0, height - fireHeight, width, fireHeight);
      for (const p of particles) {
        p.life += dt * (.07 + p.depth * .06);
        if (p.life > 1) { p.life = 0; p.x = random(0, width); }
        const y = height * (1.04 - p.life * .74), x = p.x + Math.sin(elapsed * .9 + p.phase) * (12 + p.life * 40);
        ctx.strokeStyle = `rgba(225,135,63,${Math.sin(p.life * Math.PI) * p.depth * .55})`;
        ctx.lineWidth = .5 + p.depth; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + p.depth * 5); ctx.stroke();
      }
    } else if (water) {
      for (const p of particles) {
        p.y -= dt * (8 + p.depth * 28); p.x += Math.sin(elapsed * .65 + p.phase) * dt * 5;
        if (p.y < -30) { p.y = height + 30; p.x = random(0, width); }
        const size = p.radius * (.4 + p.depth);
        ctx.globalAlpha = .3 + p.depth * .6;
        ctx.drawImage(bubble, p.x + Math.sin(p.y / 90 + p.phase) * 12 - size, p.y - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;
    } else if (preset === "SNOW") {
      for (const p of particles) {
        p.y += dt * (9 + p.depth * 27); p.x += dt * (Math.sin(elapsed * .3 + p.phase) * 14 + 5);
        if (p.y > height + 10) { p.y = -10; p.x = random(0, width); }
        if (p.x > width + 10) p.x = -10;
        ctx.fillStyle = `rgba(158,190,210,${.18 + p.depth * .36})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, .5 + p.depth * 2, 0, TAU); ctx.fill();
      }
    } else {
      const wind = -45 + Math.sin(elapsed * .24) * 18;
      ctx.drawImage(mist, Math.sin(elapsed * .08) * width * .12 - width * .2, height * .48, width * 1.3, height * .45);
      for (const p of particles) {
        p.y += dt * (190 + p.depth * 650); p.x += dt * wind * p.depth;
        if (p.y > height + 35) { p.y = -35; p.x = random(0, width); }
        if (p.x < -20) p.x = width + 20;
        ctx.globalAlpha = .16 + p.depth * .55;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-wind / 900);
        const length = 7 + p.depth * p.depth * 37;
        ctx.drawImage(drop, -1.5 - p.depth, -length, 3 + p.depth * 2, length);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      for (const s of splashes) {
        s.life += dt * .65;
        if (s.life > 1) { s.life = 0; s.x = random(0, width); s.y = random(height * .65, height); }
        ctx.strokeStyle = `rgba(132,175,199,${(1 - s.life) * .16})`; ctx.lineWidth = .65;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, 2 + s.life * 15, .5 + s.life * 3, 0, 0, TAU); ctx.stroke();
        if (s.life < .2) { ctx.beginPath(); ctx.moveTo(s.x - 2, s.y - 2); ctx.lineTo(s.x - 4, s.y - 5); ctx.moveTo(s.x + 2, s.y - 2); ctx.lineTo(s.x + 4, s.y - 6); ctx.stroke(); }
      }
    }
    if (preset === "THUNDERSTORM") {
      if (elapsed > nextBolt) makeBolt();
      if (flash > 0) {
        const alpha = Math.min(1, flash * 4), origin = bolt[0];
        // One soft local illumination; no repeated full-screen flashes.
        const cloud = ctx.createRadialGradient(origin.x, 0, 0, origin.x, 0, Math.min(width * .5, 500));
        cloud.addColorStop(0, `rgba(140,164,200,${alpha * .095})`); cloud.addColorStop(1, "transparent");
        ctx.fillStyle = cloud; ctx.fillRect(0, 0, width, height * .7);
        for (const line of [5, 1]) {
          ctx.strokeStyle = `rgba(167,190,219,${alpha * (line === 5 ? .09 : .6)})`; ctx.lineWidth = line;
          ctx.beginPath(); bolt.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
        }
        ctx.strokeStyle = `rgba(157,184,214,${alpha * .3})`; ctx.lineWidth = .7;
        for (const index of [3, 6, 8]) {
          const p = bolt[index], direction = index % 2 ? -1 : 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + direction * 30, p.y + 12);
          ctx.lineTo(p.x + direction * 19, p.y + 24); ctx.lineTo(p.x + direction * 46, p.y + 45); ctx.stroke();
        }
        flash = Math.max(0, flash - dt);
      }
    }
  };
  return { draw };
}
