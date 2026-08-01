"use client";

import { useEffect, useRef, useState } from "react";
import { STICKERS, type Sticker, type StickerPack } from "./stickers";
import { PlusIcon, SearchIcon, XIcon } from "./Icons";

type GiphyGif = { id: string; title: string; previewUrl: string; url: string };

export default function StickerPicker({
  currentUserId,
  onPick,
  onPickImage,
  onPickGif,
  onClose,
}: {
  currentUserId: number;
  onPick: (sticker: Sticker) => void;
  onPickImage: (stickerId: number) => void;
  onPickGif: (url: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activeTab, setActiveTab] = useState<"emoji" | "gif" | number>("emoji");
  const [creating, setCreating] = useState(false);
  const [newPackName, setNewPackName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GiphyGif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const response = await fetch("/api/stickers", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { packs: StickerPack[] };
        if (!disposed) setPacks(data.packs);
      } catch {
        // Picker still works with just the emoji tab if this fails.
      }
    })();
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (activeTab !== "gif") return;
    let disposed = false;
    const timer = window.setTimeout(async () => {
      if (disposed) return;
      setGifLoading(true);
      try {
        const response = await fetch(`/api/giphy/search?q=${encodeURIComponent(gifQuery)}`, { cache: "no-store" });
        const data = await response.json() as { gifs?: GiphyGif[]; error?: string };
        if (!disposed) setGifResults(response.ok ? (data.gifs ?? []) : []);
      } catch {
        if (!disposed) setGifResults([]);
      } finally {
        if (!disposed) setGifLoading(false);
      }
    }, gifQuery ? 350 : 0);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [activeTab, gifQuery]);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [onClose]);

  async function createPack() {
    const name = newPackName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/stickers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json() as { pack?: StickerPack; error?: string };
      if (!response.ok || !data.pack) throw new Error(data.error ?? "Не удалось создать набор");
      setPacks((current) => [...current, data.pack!]);
      setActiveTab(data.pack.id);
      setCreating(false);
      setNewPackName("");
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "Не удалось создать набор");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSticker(packId: number, file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/stickers/packs/${packId}`, { method: "POST", body: form });
      const data = await response.json() as { sticker?: { id: number; packId: number }; error?: string };
      if (!response.ok || !data.sticker) throw new Error(data.error ?? "Не удалось загрузить стикер");
      setPacks((current) => current.map((pack) => pack.id === packId ? { ...pack, stickers: [...pack.stickers, data.sticker!] } : pack));
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "Не удалось загрузить стикер");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSticker(packId: number, stickerId: number) {
    setPacks((current) => current.map((pack) => pack.id === packId ? { ...pack, stickers: pack.stickers.filter((item) => item.id !== stickerId) } : pack));
    await fetch(`/api/stickers/${stickerId}`, { method: "DELETE" }).catch(() => undefined);
  }

  async function deletePack(packId: number) {
    if (!window.confirm("Удалить набор стикеров?")) return;
    setPacks((current) => current.filter((pack) => pack.id !== packId));
    setActiveTab("emoji");
    await fetch(`/api/stickers/packs/${packId}`, { method: "DELETE" }).catch(() => undefined);
  }

  const activePack = typeof activeTab === "number" ? packs.find((pack) => pack.id === activeTab) : undefined;

  return (
    <div className="sticker-picker" ref={ref} role="menu" aria-label="Выбор стикера или GIF">
      <div className="sticker-tabs">
        <button type="button" className={activeTab === "emoji" ? "active" : ""} onClick={() => setActiveTab("emoji")}>Эмодзи</button>
        <button type="button" className={activeTab === "gif" ? "active" : ""} onClick={() => setActiveTab("gif")}>GIF</button>
        {packs.map((pack) => (
          <button type="button" key={pack.id} className={activeTab === pack.id ? "active" : ""} onClick={() => setActiveTab(pack.id)} title={pack.name}>
            {pack.stickers[0] ? <img src={`/api/stickers/image/${pack.stickers[0].id}`} alt="" /> : pack.name.charAt(0).toUpperCase()}
          </button>
        ))}
        <button type="button" className="sticker-tab-add" onClick={() => setCreating((current) => !current)} aria-label="Создать набор стикеров"><PlusIcon /></button>
      </div>

      {creating && (
        <div className="sticker-pack-create">
          <input
            value={newPackName}
            onChange={(event) => setNewPackName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createPack(); } }}
            placeholder="Название набора"
            maxLength={32}
            autoFocus
          />
          <button type="button" onClick={() => void createPack()} disabled={busy || !newPackName.trim()}>Создать</button>
        </div>
      )}
      {error && <div className="sticker-picker-error">{error}</div>}

      {activeTab === "emoji" ? (
        <div className="sticker-grid">
          {STICKERS.map((sticker) => (
            <button type="button" key={sticker} onClick={() => onPick(sticker)} aria-label={sticker}>
              {sticker}
            </button>
          ))}
        </div>
      ) : activeTab === "gif" ? (
        <>
          <div className="gif-search">
            <SearchIcon />
            <input value={gifQuery} onChange={(event) => setGifQuery(event.target.value)} placeholder="Поиск GIF в GIPHY" />
          </div>
          <div className="gif-grid">
            {gifResults.map((gif) => (
              <button type="button" key={gif.id} onClick={() => onPickGif(gif.url)} aria-label={gif.title || "Отправить GIF"}>
                <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
              </button>
            ))}
            {!gifLoading && gifResults.length === 0 && <p className="sticker-empty">Ничего не найдено</p>}
          </div>
        </>
      ) : activePack ? (
        <>
          <div className="sticker-grid images">
            {activePack.stickers.map((item) => (
              <div className="sticker-item" key={item.id}>
                <button type="button" onClick={() => onPickImage(item.id)} aria-label="Отправить стикер">
                  <img src={`/api/stickers/image/${item.id}`} alt="Стикер" />
                </button>
                {activePack.creatorId === currentUserId && (
                  <button type="button" className="sticker-item-remove" onClick={() => void deleteSticker(activePack.id, item.id)} aria-label="Удалить стикер"><XIcon /></button>
                )}
              </div>
            ))}
            {activePack.creatorId === currentUserId && (
              <>
                <button type="button" className="sticker-item-upload" onClick={() => uploadRef.current?.click()} disabled={busy} aria-label="Загрузить стикер"><PlusIcon /></button>
                <input
                  ref={uploadRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadSticker(activePack.id, file); event.target.value = ""; }}
                />
              </>
            )}
            {activePack.stickers.length === 0 && activePack.creatorId !== currentUserId && <p className="sticker-empty">В наборе пока нет стикеров</p>}
          </div>
          {activePack.creatorId === currentUserId && (
            <button type="button" className="sticker-pack-delete" onClick={() => void deletePack(activePack.id)}>Удалить набор «{activePack.name}»</button>
          )}
        </>
      ) : null}
    </div>
  );
}
