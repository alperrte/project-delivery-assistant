"use client";

import { NotificationCenter } from "./components/notification-center";

/** Both header entry points share the session-scoped center and popup owner. */
export function NotificationsMenu({ userId, disabled = false }: { userId?: string; disabled?: boolean }) {
  return <NotificationCenter expectedUserId={userId} disabled={disabled} />;
}
