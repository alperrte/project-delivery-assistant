/** Wire shapes of the project chat API (`/projects/{id}/chat/**`) and of the WebSocket events. No email anywhere. */

export type ChatConversationType = "PROJECT" | "DIRECT";

/** `profilePhotoVersion` is the cache-busting version of the profile photo, null when the person has none. */
export type ChatUser = {
  userId: string;
  nickname: string | null;
  profilePhotoVersion: number | null;
};

export type ChatAttachment = { id: string; filename: string; contentType: string; size: number };
export type ChatMessageInfo = { messageId: string; readers: {user: ChatUser; readAt: string | null; legacy: boolean}[] };
export type MessageDeliveryStatus = "SENT" | "DELIVERED" | "READ";

export type ChatMessage = {
  attachment?: ChatAttachment | null;
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  sender: ChatUser;
  replyTo: ChatReply | null;
  reactionVersion: string;
  reactions: ChatReaction[];
  /** The sender deleted it: the text is gone, only a tombstone remains. */
  deleted?: boolean;
  deliveryStatus?: MessageDeliveryStatus;
};

export type ReactionCode = "THUMBS_UP" | "HEART" | "LAUGH" | "SURPRISED" | "SAD" | "THANKS";
export type ChatReply = { id: string; sender: ChatUser; preview: string; deleted?: boolean };
export type ChatReaction = { code: ReactionCode; emoji: string; count: number; reactedByCurrentUser: boolean };
export type ReactionSnapshot = { messageId: string; reactionVersion: string; reactions: ChatReaction[] };
export type ReactionDetails = ReactionSnapshot & { users: { code: ReactionCode; user: ChatUser }[]; total: number; page: number; size: number };

export type ChatLastMessage = {
  preview: string;
  createdAt: string;
  senderUserId: string;
  deleted?: boolean;
};

/** `peer` is the other person of a direct conversation and null for the project group. */
export type ChatConversation = {
  id: string;
  type: ChatConversationType;
  peer: ChatUser | null;
  lastMessage: ChatLastMessage | null;
  unread: number;
  projectId?: string;
  projectName?: string;
  logoVersion?: number | null;
  logoShape?: "SQUARE" | "CIRCLE";
};

export type ChatOverview = {
  group: ChatConversation | null;
  groups: ChatConversation[];
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
  projectId?: string | null;
  conversationId: string;
};
export type ChatSocketEvent = ChatEventScope & (
  | { type: "MESSAGE"; conversationType?: ChatConversationType; message: ChatMessage }
  | { type: "READ" }
  | ({ type: "REACTIONS" } & ReactionSnapshot)
  | { type: "TYPING"; userId: string; nickname: string | null; typing: boolean }
  | { type: "DELETED"; messageId: string }
  | { type: "SEEN"; userId: string; readAt: string }
  | { type: "DELIVERED"; recipientId: string; messageIds: string[] }
);

/** "`userId` has read this conversation up to `readAt`" (ISO instant): a message is seen when `readAt` is not before it. */
export type ChatReceipt = { userId: string; readAt: string; messageId?: string };

/** Someone who is typing right now in a conversation (ephemeral, browser-only). */
export type TypingPerson = { userId: string; nickname: string | null };

/** What the user is looking at. A direct conversation gets its id once it was opened on the server. */
export type ActiveConversation =
  | { kind: "group"; conversationId?: string }
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
export type ChatSearchPage = { messages: ChatMessage[]; total: number; page: number; size: number };
export type ChatMessageContext = { messages: ChatMessage[]; hasOlder: boolean; hasNewer: boolean };
