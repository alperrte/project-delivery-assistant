import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "emblem" | "wordmark" | "full";
  size?: number;
  className?: string;
  priority?: boolean;
};

// One wordmark file per theme, used as delivered; CSS shows the matching one.
// `box` (x0, y0, x1, y1, in file pixels) spans the "PDA" letters horizontally
// and runs from their top to the tagline's bottom; glow and the tagline's side
// lines fall outside it and simply overflow. The light box is measured, the
// dark one is the same-proportion box that best overlaps it, so both themes
// render the logo at the same size and place (no jump on theme change) and the
// files' transparent margins never push the layout around.
const WORDMARKS = [
  { src: "/images/branding/yazi-light.png", width: 2172, height: 724, box: [115, 98, 2064, 635], theme: "dark:hidden" },
  { src: "/images/branding/yazi-dark.png", width: 1672, height: 941, box: [105, 276, 1587, 684], theme: "hidden dark:block" },
] as const;

export function Logo({ variant = "emblem", size = 72, className, priority }: LogoProps) {
  if (variant === "emblem") {
    return (
      <Image
        src="/images/branding/icon.png"
        alt="PDA"
        width={size}
        height={size}
        priority={priority}
        className={cn("object-contain drop-shadow-[0_6px_18px_var(--shadow-tint)]", className)}
      />
    );
  }

  if (variant === "full") {
    return (
      <Image
        src="/images/branding/pda-full.png"
        alt="PDA · Project Delivery Assistant"
        width={size}
        height={size}
        priority={priority}
        className={cn("object-contain", className)}
      />
    );
  }

  // `size` caps the width of the visible artwork; the height follows it.
  return (
    <>
      <GlowFilter />
      {WORDMARKS.map(({ src, width, height, box: [x0, y0, x1, y1], theme }) => {
        const boxW = x1 - x0;
        const boxH = y1 - y0;
        const image = {
          src,
          width,
          height,
          priority,
          sizes: `${Math.ceil((size * width) / boxW)}px`,
          className: "absolute h-auto max-w-none",
          style: {
            width: `${(width / boxW) * 100}%`,
            left: `${(-x0 / boxW) * 100}%`,
            top: `${(-y0 / boxH) * 100}%`,
          },
        };
        return (
          <span
            key={src}
            className={cn("relative block w-full", theme, className)}
            style={{ maxWidth: size, aspectRatio: `${boxW} / ${boxH}` }}
          >
            <Image alt="PDA · Project Delivery Assistant" {...image} />
            {/* The same file again, reduced to its blue glows, pulsing on top. */}
            <span aria-hidden className="logo-glow absolute inset-0">
              <Image alt="" {...image} style={{ ...image.style, filter: `url(#${GLOW_FILTER_ID})` }} />
            </span>
          </span>
        );
      })}
    </>
  );
}

const GLOW_FILTER_ID = "pda-logo-glow";

/**
 * Keeps only the logo's cyan/blue pixels (alpha = 3·(G/2 + B/2 − R) − 0.9,
 * times the file's own alpha, so neither the chrome letters nor fully
 * transparent pixels leak through) and adds a soft halo around them.
 */
function GlowFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id={GLOW_FILTER_ID} colorInterpolationFilters="sRGB" x="-5%" y="-20%" width="110%" height="140%">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -3 1.5 1.5 0 -0.9"
          result="blue"
        />
        <feComposite in="blue" in2="SourceAlpha" operator="in" result="glow" />
        <feGaussianBlur in="glow" stdDeviation="4" result="halo" />
        <feMerge>
          <feMergeNode in="halo" />
          <feMergeNode in="halo" />
          <feMergeNode in="glow" />
        </feMerge>
      </filter>
    </svg>
  );
}
