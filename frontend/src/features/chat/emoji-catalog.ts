import { REACTION_EMOJI } from "./reactions";
import type { ReactionCode } from "./types";

export type EmojiChoice = { key: string; emoji: string; code?: ReactionCode };
export const REACTION_CHOICES: EmojiChoice[] = Object.entries(REACTION_EMOJI).map(([code, emoji]) => ({ key: code, emoji, code: code as ReactionCode }));
export const COMPOSER_CHOICES: EmojiChoice[] = [
  ["SMILE","😀"],["GRIN","😄"],["LAUGH","😂"],["ROFL","🤣"],["BLUSH","😊"],["LOVE","😍"],
  ["PARTY","🥳"],["COOL","😎"],["THINK","🤔"],["SURPRISED","😮"],["SAD","😢"],["CRY","😭"],
  ["SWEAT","😅"],["SLEEP","😴"],["THUMBS_UP","👍"],["THUMBS_DOWN","👎"],["CLAP","👏"],["RAISE","🙌"],
  ["THANKS","🙏"],["HEART","❤️"],["FIRE","🔥"],["CELEBRATE","🎉"],["CHECK","✅"],["ROCKET","🚀"],
].map(([key,emoji]) => ({key,emoji}));

/** DOM selection offsets are UTF-16; never split a surrogate pair. */
export function insertEmoji(text: string, start: number, end: number, emoji: string) {
  start=Math.max(0,Math.min(start,text.length));end=Math.max(start,Math.min(end,text.length));
  const splits=(index:number)=>index>0&&index<text.length&&/[\uD800-\uDBFF]/.test(text[index-1])&&/[\uDC00-\uDFFF]/.test(text[index]);
  if(start===end&&splits(start)){start-=1;end=start;}
  else {if(splits(start))start-=1;if(splits(end))end+=1;}
  return {text:text.slice(0,start)+emoji+text.slice(end),caret:start+emoji.length};
}
