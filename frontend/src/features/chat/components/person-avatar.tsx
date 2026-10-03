"use client";

import { useState } from "react";
import { UsersThree } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";
import { cn } from "@/lib/utils";
import type { ChatUser } from "../types";

/** A person in the chat: their photo when they have one, their initials otherwise (the app's one `Avatar`). */
export function PersonAvatar({ user, className }: { user: Pick<ChatUser, "userId" | "nickname" | "profilePhotoVersion">; className?: string }) {
  const name = user.nickname ?? "?";
  return <Avatar name={name} src={profilePhotoSrc(user.userId, user.profilePhotoVersion)} className={className} />;
}

/**
 * The project group shows the project's logo when it has one (or when it fails to load: the people icon), so the
 * group reads as the project itself.
 */
export function GroupAvatar({ logoSrc, className }: { logoSrc?: string | null; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showLogo = Boolean(logoSrc) && failedSrc !== logoSrc;
  return (
    <span
      aria-hidden="true"
      data-slot="group-avatar"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary ring-2 ring-card",
        className,
      )}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated, versioned API image; next/image cannot proxy it
        <img src={logoSrc!} alt="" className="size-full object-cover" onError={() => setFailedSrc(logoSrc ?? null)} />
      ) : (
        <UsersThree size={16} weight="fill" />
      )}
    </span>
  );
}
