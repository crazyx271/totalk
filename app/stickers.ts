export const STICKERS = [
  "🎉", "❤️", "😂", "👍", "🔥",
  "😢", "😮", "🙌", "💯", "🥳",
  "😴", "👀", "✨", "🤝", "😎",
] as const;

export type Sticker = (typeof STICKERS)[number];

export function isSticker(value: string): value is Sticker {
  return (STICKERS as readonly string[]).includes(value);
}

export type StickerImage = { id: number; packId: number };
export type StickerPack = { id: number; name: string; creatorId: number; stickers: StickerImage[] };
