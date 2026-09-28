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
      {WORDMARKS.map(({ src, width, height, box: [x0, y0, x1, y1], theme }) => {
        const boxW = x1 - x0;
        const boxH = y1 - y0;
        return (
          <span
            key={src}
            className={cn("relative block w-full", theme, className)}
            style={{ maxWidth: size, aspectRatio: `${boxW} / ${boxH}` }}
          >
            <Image
              src={src}
              alt="PDA · Project Delivery Assistant"
              width={width}
              height={height}
              priority={priority}
              sizes={`${Math.ceil((size * width) / boxW)}px`}
              className="absolute h-auto max-w-none"
              style={{
                width: `${(width / boxW) * 100}%`,
                left: `${(-x0 / boxW) * 100}%`,
                top: `${(-y0 / boxH) * 100}%`,
              }}
            />
          </span>
        );
      })}
    </>
  );
}
