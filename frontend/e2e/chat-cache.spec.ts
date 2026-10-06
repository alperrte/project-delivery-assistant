import { test, expect } from "@playwright/test";
import { QueryClient } from "@tanstack/react-query";
import { appendMessages, applyReactionSnapshots, chatKeys, flattenMessages, type MessagePages } from "../src/features/chat/cache";
import { ReactionBuffer, validReactionSnapshot } from "../src/features/chat/reactions";
import { ReactionSyncQueue, resyncReactions } from "../src/features/chat/reaction-resync";
import { parseChatSocketEvent } from "../src/features/chat/use-chat-socket";
import type { ChatMessage, ReactionSnapshot } from "../src/features/chat/types";
import { pendingMatches } from "../src/features/chat/pending";
import { insertEmoji } from "../src/features/chat/emoji-catalog";

const message = (id: string, conversationId = "c"): ChatMessage => ({ id, conversationId, content: "text", createdAt: "2026-10-05T10:00:00Z", sender: { userId: "u", nickname: "User", profilePhotoVersion: null }, replyTo: null, reactionVersion: "0", reactions: [] });
const snapshot = (id: string, version: string, count = 1): ReactionSnapshot => ({ messageId: id, reactionVersion: version, reactions: count ? [{ code: "THUMBS_UP", emoji: "👍", count, reactedByCurrentUser: true }] : [] });

test("emoji insertion respects DOM UTF-16 selection and never splits surrogate pairs", () => {
  expect(insertEmoji("A😀B",1,3,"😂")).toEqual({text:"A😂B",caret:3});
  expect(insertEmoji("A😀B",2,2,"❤️")).toEqual({text:"A❤️😀B",caret:3});
  expect(insertEmoji("Hello",5,5,"😂❤️")).toEqual({text:"Hello😂❤️",caret:9});
});

test("outbox acknowledgement retains the submitted reply identity across identical text and retries", () => {
  const pending = { clientId:"client",content:"14:00",status:"sending" as const,sentAt:1,replyTo:{id:"original",sender:message("m").sender,preview:"Question"} };
  expect(pendingMatches(pending,"14:00","another-original")).toBe(false);
  expect(pendingMatches(pending,"14:00",null)).toBe(false);
  expect(pendingMatches(pending,"14:00","original")).toBe(true);
  expect(pendingMatches({...pending,status:"failed"},"14:00","original")).toBe(false);
});
function seed(q: QueryClient, cid: string, messages: ChatMessage[]) { q.setQueryData<MessagePages>(chatKeys.messages("p", cid), { pages: [{ messages, hasMore: false }], pageParams: [undefined] }); }
function current(q: QueryClient, cid = "c") { return flattenMessages(q.getQueryData<MessagePages>(chatKeys.messages("p", cid))); }

test("duplicate/out-of-order snapshots patch only messages; deletion preserves a newer empty version", () => {
  const q = new QueryClient(); seed(q,"c",[message("m")]);
  q.setQueryData(chatKeys.overview("p"),{totalUnread:3});
  applyReactionSnapshots(q,"p","c",[snapshot("m","9007199254740993",2)]);
  applyReactionSnapshots(q,"p","c",[snapshot("m","9007199254740992",1)]);
  applyReactionSnapshots(q,"p","c",[snapshot("m","9007199254740993",2)]);
  expect(current(q)[0].reactions[0].count).toBe(2);
  applyReactionSnapshots(q,"p","c",[snapshot("m","9007199254740994",0)]);
  appendMessages(q,"p","c",[message("m")]);
  expect(current(q)[0].reactionVersion).toBe("9007199254740994");
  expect(current(q)[0].reactions).toEqual([]);
  expect(q.getQueryData(chatKeys.overview("p"))).toEqual({totalUnread:3});
  applyReactionSnapshots(q,"other-project","c",[snapshot("m","99")]);
  expect(current(q)[0].reactions).toEqual([]);
  expect(q.getQueryData(chatKeys.messages("other-project","c"))).toBeUndefined();
  q.clear();
});

test("buffer precedes MESSAGE without phantom rows, expires and keeps a bounded latest version", () => {
  let now=0;const buffer=new ReactionBuffer(()=>now,2,10),q=new QueryClient();
  buffer.put("c",snapshot("m","2"));buffer.put("c",snapshot("m","1"));
  expect(applyReactionSnapshots(q,"p","c",[snapshot("m","2")]).size).toBe(0);
  expect(q.getQueryData(chatKeys.messages("p","c"))).toBeUndefined();
  seed(q,"c",[message("m")]);
  applyReactionSnapshots(q,"p","c",buffer.takeLoaded("c",new Set(["m"])));
  expect(current(q)[0].reactionVersion).toBe("2");
  buffer.put("c",snapshot("a","1"));buffer.put("c",snapshot("b","1"));buffer.put("c",snapshot("d","1"));
  expect(buffer.takeLoaded("c",new Set(["a","b","d"])).map(value=>value.messageId)).toEqual(["b","d"]);
  buffer.put("c",snapshot("m","3"));now=11;
  expect(buffer.takeLoaded("c",new Set(["m"]))).toEqual([]);
  buffer.put("c",snapshot("m","4"));buffer.clear();
  expect(buffer.takeLoaded("c",new Set(["m"]))).toEqual([]);q.clear();
});

test("loaded history resync uses 50-ID batches and at most two HTTP operations across conversations", async () => {
  const q=new QueryClient(),queue=new ReactionSyncQueue(),controller=new AbortController();
  seed(q,"a",Array.from({length:121},(_,i)=>message(`a${i}`,"a")));
  seed(q,"b",Array.from({length:55},(_,i)=>message(`b${i}`,"b")));
  let active=0,max=0;const sizes:number[]=[];
  const fetcher=async(ids:string[])=>{sizes.push(ids.length);active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return ids.map(id=>snapshot(id,"1"));};
  const options={signal:controller.signal,current:()=>true,queue};
  await Promise.all([resyncReactions(q,"p","a",fetcher,options),resyncReactions(q,"p","b",fetcher,options)]);
  expect(sizes.sort((a,b)=>a-b)).toEqual([5,21,50,50,50]);expect(max).toBe(2);
  expect(current(q,"a").every(value=>value.reactionVersion==="1")).toBe(true);
  expect(current(q,"b").every(value=>value.reactionVersion==="1")).toBe(true);q.clear();
});

test("a newer socket snapshot beats slow REST; a late previous-account response cannot touch replacement cache", async () => {
  const q=new QueryClient();seed(q,"c",[message("m")]);
  const queue=new ReactionSyncQueue(),controller=new AbortController();
  let release!:(value:ReactionSnapshot[])=>void,started!:()=>void;
  const ready=new Promise<void>(resolve=>{started=resolve;});
  const job=resyncReactions(q,"p","c",()=>{started();return new Promise(resolve=>{release=resolve;});},{signal:controller.signal,current:()=>true,queue});
  await ready;applyReactionSnapshots(q,"p","c",[snapshot("m","2",2)]);release([snapshot("m","1")]);await job;
  expect(current(q)[0].reactionVersion).toBe("2");
  let active=true,releaseOld!:(value:ReactionSnapshot[])=>void,startedOld!:()=>void;
  const oldReady=new Promise<void>(resolve=>{startedOld=resolve;});
  const oldJob=resyncReactions(q,"p","c",()=>{startedOld();return new Promise(resolve=>{releaseOld=resolve;});},{signal:controller.signal,current:()=>active,queue});
  await oldReady;active=false;controller.abort();seed(q,"c",[message("m")]);releaseOld([snapshot("m","9")]);await oldJob;
  expect(current(q)[0].reactionVersion).toBe("0");q.clear();
});

test("socket union validates reactions and normalizes legacy messages instead of treating a reaction as MESSAGE", () => {
  const scope={projectId:"p",conversationId:"c"};
  expect(parseChatSocketEvent(JSON.stringify({...scope,type:"REACTIONS",...snapshot("m","1")}))?.type).toBe("REACTIONS");
  expect(parseChatSocketEvent(JSON.stringify({...scope,type:"REACTIONS",...snapshot("m","-1")}))).toBeNull();
  expect(validReactionSnapshot({...snapshot("m","1"),reactions:[{code:"HEART",emoji:"x",count:1,reactedByCurrentUser:true}]})).toBe(false);
  expect(validReactionSnapshot(snapshot("x".repeat(129),"1"))).toBe(false);
  expect(validReactionSnapshot({...snapshot("m","1"),reactions:[snapshot("m","1").reactions[0],snapshot("m","1").reactions[0]]})).toBe(false);
  expect(parseChatSocketEvent(JSON.stringify({...scope,type:"MESSAGE",message:{...message("m"),content:"x".repeat(2001)}}))).toBeNull();
  const old=message("m") as Partial<ChatMessage>;delete old.reactionVersion;delete old.reactions;delete old.replyTo;
  const parsed=parseChatSocketEvent(JSON.stringify({...scope,type:"MESSAGE",message:old}));
  expect(parsed?.type).toBe("MESSAGE");if(parsed?.type==="MESSAGE"){expect(parsed.message.reactionVersion).toBe("0");expect(parsed.message.replyTo).toBeNull();}
  expect(parseChatSocketEvent(JSON.stringify({...scope,type:"UNKNOWN"}))).toBeNull();
});
