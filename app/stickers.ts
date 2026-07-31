export const STICKERS = [
  "🎉", "❤️", "😂", "👍", "🔥",
  "😢", "😮", "🙌", "💯", "🥳",
  "😴", "👀", "✨", "🤝", "😎",
] as const;

export type Sticker = (typeof STICKERS)[number];

export function isSticker(value: string): value is Sticker {
  return (STICKERS as readonly string[]).includes(value);
}
