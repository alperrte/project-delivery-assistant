import { cn } from "@/lib/utils"

const TINTS = [
  "bg-primary/15 text-primary",
  "bg-live/15 text-live",
  "bg-[#7a6ff0]/15 text-[#7a6ff0]",
] as const

function Avatar({
  name,
  tint = 0,
  className,
}: {
  name: string
  tint?: number
  className?: string
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <span
      data-slot="avatar"
      title={name}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-card",
        TINTS[tint % TINTS.length],
        className
      )}
    >
      {initials}
    </span>
  )
}

export { Avatar }
