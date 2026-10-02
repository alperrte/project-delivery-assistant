"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const TINTS = [
  "bg-primary/15 text-primary",
  "bg-live/15 text-live",
  "bg-[#7a6ff0]/15 text-[#7a6ff0]",
] as const

/**
 * The one avatar of the app: a person's photo when `src` is given, their initials otherwise (and when the photo
 * fails to load, so a broken image never shows). `src` is built by the caller from the profile photo version.
 */
function Avatar({
  name,
  src,
  tint = 0,
  className,
}: {
  name: string
  src?: string | null
  tint?: number
  className?: string
}) {
  // Remember which source failed instead of a boolean, so a new photo URL gets its own chance to load.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const words = name.trim().split(/\s+/).filter(Boolean)
  // A single word (a nickname) shows its first two letters; a full name shows the first letter of two words.
  const initials = (words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join("") : (words[0] ?? "").slice(0, 2)).toUpperCase()
  const showPhoto = Boolean(src) && failedSrc !== src

  return (
    <span
      data-slot="avatar"
      title={name}
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold ring-2 ring-card",
        TINTS[tint % TINTS.length],
        className
      )}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated, versioned API image; next/image cannot proxy it
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src ?? null)}
          className="size-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  )
}

export { Avatar }
