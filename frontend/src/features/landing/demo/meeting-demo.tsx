"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { MicOff } from "lucide-react";
import { MeetingCard } from "@/features/meetings/meeting-card";
import { RoomControls } from "@/features/meetings/room/room-controls";
import { DemoRoot } from "./demo-root";
import styles from "../landing.module.css";

const noop = () => {};
const leave = async () => {};

/** A live project meeting, the real call bar and an independent meeting. The tiles are static avatars: a demo never opens a media connection. */
export function MeetingDemo() {
  const t = useTranslations("landing");
  const [now] = useState(() => Date.now());
  return <DemoRoot>{data => <div className={styles.meetingDemo}>
    <MeetingCard meeting={data.meetings[0]} now={now} canEdit canEnd onAction={async () => {}} />
    <div className={styles.room}>
      <ul className={styles.roomTiles}>
        {data.members.map((member, index) => <li key={member.userId} className={styles.roomTile}>
          <Avatar name={member.nickname ?? "?"} src={null} className="size-14 text-lg" />
          <span>{member.nickname}</span>
          {index === 2 && <MicOff size={14} aria-hidden="true" className={styles.roomMuted} />}
        </li>)}
        <li className={styles.roomTile}><Avatar name="+1" src={null} className="size-14 text-lg" /><span>{t("demoGuest")}</span></li>
      </ul>
      <RoomControls active mediaBusy={false} mic camera={false} sharing={false} screenBusy={false} screenSupported panel={null} unread={0} keyboard={false}
        canEndForAll grid={false} onGrid={noop} onMic={noop} onCamera={noop} onScreen={noop} onPanel={noop} onEndForAll={noop} onLeave={leave} />
    </div>
    <MeetingCard meeting={data.meetings[1]} now={now} canEdit canEnd onAction={async () => {}} />
  </div>}</DemoRoot>;
}
