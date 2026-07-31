"use client";

import { useEffect, useRef } from "react";
import { STICKERS, type Sticker } from "./stickers";

export default function StickerPicker({
  onPick,
  onClose,
}: {
  onPick: (sticker: Sticker) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [onClose]);

  return (
    <div className="sticker-picker" ref={ref} role="menu" aria-label="Выбор стикера">
      {STICKERS.map((sticker) => (
        <button type="button" key={sticker} onClick={() => onPick(sticker)} aria-label={sticker}>
          {sticker}
        </button>
      ))}
    </div>
  );
}
