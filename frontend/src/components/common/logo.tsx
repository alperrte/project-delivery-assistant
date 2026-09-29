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
      <CurrentFilter />
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
            {/*
              The same file again, reduced to a thin bright line along the
              letters' edges; `logo-current` masks it down to electrons that
              orbit each letter. The outer span overhangs the box so the
              line's glow is not cut at the letters' outer edges; the inner
              one maps back onto the box.
            */}
            <span aria-hidden className="logo-current absolute -inset-x-[4%] -inset-y-[15%]">
              <span className="absolute inset-x-[3.7037%] inset-y-[11.5385%] will-change-transform">
                <Image alt="" {...image} style={{ ...image.style, filter: `url(#${CURRENT_FILTER_ID})` }} />
              </span>
            </span>
          </span>
        );
      })}
    </>
  );
}

const CURRENT_FILTER_ID = "pda-logo-current";

/**
 * Traces the letters' outlines: the file's alpha, hardened so the soft outer
 * glow does not count as letter, minus itself eroded by 2px, leaves a thin
 * rim along every edge (outer contours and the letters' holes). The rim is
 * drawn near-white with a cyan halo.
 */
function CurrentFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id={CURRENT_FILTER_ID} colorInterpolationFilters="sRGB" x="-5%" y="-20%" width="110%" height="140%">
        <feComponentTransfer in="SourceAlpha" result="solid">
          <feFuncA type="linear" slope="8" intercept="-6" />
        </feComponentTransfer>
        <feMorphology in="solid" operator="erode" radius="2" result="inner" />
        <feComposite in="solid" in2="inner" operator="out" result="rim" />
        <feFlood floodColor="#d6fbff" />
        <feComposite in2="rim" operator="in" result="line" />
        <feFlood floodColor="#2fd0f5" />
        <feComposite in2="rim" operator="in" result="tint" />
        <feGaussianBlur in="tint" stdDeviation="3.5" result="halo" />
        <feMerge>
          <feMergeNode in="halo" />
          <feMergeNode in="halo" />
          <feMergeNode in="line" />
        </feMerge>
      </filter>
    </svg>
  );
}
