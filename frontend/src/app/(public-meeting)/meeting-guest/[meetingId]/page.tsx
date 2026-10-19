import { MeetingRoom } from "@/features/meetings/meeting-room";
import type { Viewport } from "next";
import { pageTitle } from "@/lib/seo/page-title";
/** Phones: let the layout use the notch area (the call bar pads for it) and shrink with the keyboard so the chat input stays visible. */
export const viewport: Viewport = { viewportFit: "cover", interactiveWidget: "resizes-content" };
export const generateMetadata = () => pageTitle("meetingRoom");
export default async function Page({ params }: { params: Promise<{ meetingId: string }> }) { const { meetingId } = await params; return <main className="min-h-dvh bg-background p-4 sm:p-8"><MeetingRoom key={meetingId} id={meetingId} /></main>; }
