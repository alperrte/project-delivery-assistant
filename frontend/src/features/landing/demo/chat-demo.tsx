"use client";

import { useEffect, useRef, useState } from "react";
import { ChatProvider } from "@/features/chat/chat-provider";
import { MessageList } from "@/features/chat/components/message-list";
import { TypingIndicator } from "@/features/chat/components/typing-indicator";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { DEMO_USER } from "./demo-data";
import { DemoRoot } from "./demo-root";
import styles from "../landing.module.css";

const noop = () => {};
const neverReact = () => false;

/** The real message list with a group conversation (reaction, file, own message). The messages drop in one by one once the demo is on screen. */
export function ChatDemo() {
  const reduce = useReducedMotionPreference();
  const root = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (reduce || !("IntersectionObserver" in window)) { const frame = requestAnimationFrame(() => setCount(3)); return () => cancelAnimationFrame(frame); }
    let timer = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const next = (value: number) => { setCount(value); if (value < 3) timer = window.setTimeout(() => next(value + 1), 850); };
      timer = window.setTimeout(() => next(1), 250);
    }, { threshold: .35 });
    observer.observe(element);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [reduce]);
  return <DemoRoot>{data => <ChatProvider disabled><div ref={root} className={styles.chatDemo}>
    <div className={styles.chatHead}><strong>{data.project.name}</strong><span>{data.members.length}</span></div>
    <div className={styles.chatBody}>
      <MessageList conversationId="pda-demo-chat" messages={data.messages.slice(0, count)} outbox={[]} selfId={DEMO_USER.id} showSenders loading={false} error={false}
        onRetryLoad={noop} hasOlder={false} loadingOlder={false} onLoadOlder={noop} onAtBottomChange={noop} onRetrySend={noop} onDiscard={noop} errorLabel={key => key}
        onReply={noop} onReact={noop} reactionPending={neverReact} reactionsDisabled onDelete={async () => {}} receipts={[]} />
    </div>
    <TypingIndicator people={count >= 3 ? [{ userId: data.members[1].userId, nickname: data.members[1].nickname ?? null }] : []} />
  </div></ChatProvider>}</DemoRoot>;
}
