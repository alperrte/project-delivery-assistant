/** Wire shapes of the project chat API (`/projects/{id}/chat/**`) and of the WebSocket events. No email anywhere. */

export type ChatConversationType = "PROJECT" | "DIRECT";

/** `profilePhotoVersion` is the cache-busting version of the profile photo, null when the person has none. */
export type ChatUser = {
  userId: string;
  nickname: string | null;
  profilePhotoVersion: number | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  sender: ChatUser;
  replyTo: ChatReply | null;
  reactionVersion: string;
  reactions: ChatReaction[];
};

export type ReactionCode = "THUMBS_UP" | "HEART" | "LAUGH" | "SURPRISED" | "SAD" | "THANKS";
export type ChatReply = { id: string; sender: ChatUser; preview: string };
export type ChatReaction = { code: ReactionCode; emoji: string; count: number; reactedByCurrentUser: boolean };
export type ReactionSnapshot = { messageId: string; reactionVersion: string; reactions: ChatReaction[] };

export type ChatLastMessage = {
  preview: string;
  createdAt: string;
  senderUserId: string;
};

/** `peer` is the other person of a direct conversation and null for the project group. */
export type ChatConversation = {
  id: string;
  type: ChatConversationType;
  peer: ChatUser | null;
  lastMessage: ChatLastMessage | null;
  unread: number;
};

export type ChatOverview = {
  group: ChatConversation;
  directs: ChatConversation[];
  totalUnread: number;
};

/** Another member of the project; `conversationId` is set once a direct conversation exists. */
export type ChatMember = ChatUser & {
  conversationId: string | null;
};

/** Messages oldest to newest; `hasMore` tells whether more exist in the direction that was paged. */
export type ChatMessagePage = {
  messages: ChatMessage[];
  hasMore: boolean;
};

type ChatEventScope = {
  projectId: string;
  conversationId: string;
};
export type ChatSocketEvent = ChatEventScope & (
  | { type: "MESSAGE"; conversationType?: ChatConversationType; message: ChatMessage }
  | { type: "READ" }
  | ({ type: "REACTIONS" } & ReactionSnapshot)
);

/** What the user is looking at. A direct conversation gets its id once it was opened on the server. */
export type ActiveConversation =
  | { kind: "group" }
  | { kind: "direct"; peerId: string; conversationId?: string };

/** The panel's state: `closed` (nothing shown), `full` (main area), `bar` (bottom-right title bar), `compact` (window). */
export type ChatMode = "closed" | "full" | "bar" | "compact";

export type ChatConnection = "connecting" | "connected" | "disconnected";

/** A message the user sent that the server has not confirmed yet (or that failed). Lives only in the browser. */
export type PendingMessage = {
  clientId: string;
  content: string;
  status: "sending" | "failed";
  /** Key under the `errors` i18n namespace, set when `status` is `failed`. */
  errorKey?: string;
  /** Client time the user pressed send, only used to place the bubble after the confirmed messages. */
  sentAt: number;
  replyTo?: ChatReply | null;
};
