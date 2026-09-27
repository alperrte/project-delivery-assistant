import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "emblem" | "wordmark" | "full";
  size?: number;
  className?: string;
  priority?: boolean;
};

const JPEG = { wordmark: "/images/branding/yazı.jpeg" } as const;

/**
 * The emblem and full logo are transparent PNGs and work on any surface. The
 * wordmark is still a white-background JPEG: multiplied into light surfaces,
 * on a light rounded plate in dark mode, until a transparent version exists.
 */
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

  return (
    <span className={cn("inline-flex overflow-hidden rounded-2xl dark:bg-white dark:p-1.5", className)}>
      <Image
        src={JPEG[variant]}
        alt="PDA"
        width={size * 4}
        height={size * 4}
        priority={priority}
        style={{ width: "auto", height: size }}
        className="object-contain mix-blend-multiply"
      />
    </span>
  );
}
