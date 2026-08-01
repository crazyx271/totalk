"use client";

import { useEffect, useState } from "react";
import { SearchIcon, XIcon } from "./Icons";

type GiphyGif = { id: string; title: string; previewUrl: string; url: string };

export default function GiphyPickerModal({
  title,
  onSelect,
  onClose,
}: {
  title: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(async () => {
      if (disposed) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/giphy/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const data = await response.json() as { gifs?: GiphyGif[]; error?: string };
        if (disposed) return;
        if (!response.ok) { setError(data.error ?? "GIPHY недоступен"); setGifs([]); }
        else { setError(""); setGifs(data.gifs ?? []); }
      } catch {
        if (!disposed) { setError("GIPHY недоступен"); setGifs([]); }
      } finally {
        if (!disposed) setLoading(false);
      }
    }, query ? 350 : 0);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [query]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card giphy-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть"><XIcon /></button>
        <h2>{title}</h2>
        <div className="gif-search">
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск GIF в GIPHY" autoFocus />
        </div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <div className="gif-grid modal-gif-grid">
          {gifs.map((gif) => (
            <button type="button" key={gif.id} onClick={() => onSelect(gif.url)} aria-label={gif.title || "Выбрать GIF"}>
              <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
            </button>
          ))}
          {!loading && gifs.length === 0 && !error && <p className="sticker-empty">Ничего не найдено</p>}
        </div>
      </div>
    </div>
  );
}
