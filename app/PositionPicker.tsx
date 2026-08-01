"use client";

import { useRef, useState } from "react";

export default function PositionPicker({
  src,
  shape,
  value,
  onChange,
}: {
  src: string;
  shape: "circle" | "wide";
  value: string;
  onChange: (position: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function updateFromPoint(clientX: number, clientY: number) {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    onChange(`${Math.round(x)}% ${Math.round(y)}%`);
  }

  return (
    <div
      ref={frameRef}
      className={`position-picker ${shape}`}
      onMouseDown={(event) => { setDragging(true); updateFromPoint(event.clientX, event.clientY); }}
      onMouseMove={(event) => { if (dragging) updateFromPoint(event.clientX, event.clientY); }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      role="button"
      tabIndex={0}
      aria-label="Выбрать область изображения"
    >
      <img src={src} alt="" style={{ objectPosition: value }} draggable={false} />
      <div className="position-picker-hint">Перетащите, чтобы выбрать область</div>
    </div>
  );
}
