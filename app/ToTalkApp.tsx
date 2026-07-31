"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import HomeHub from "./HomeHub";
import VoiceCallOverlay from "./VoiceCallOverlay";
import StickerPicker from "./StickerPicker";
import ProfileModal from "./ProfileModal";
import { useVoiceChat } from "./useVoiceChat";
import type { Sticker } from "./stickers";
import type { ToTalkUser } from "./page";

type Message = {
  id: number;
  userId?: number;
  author: string;
  username?: string;
  avatar: string;
  time: string;
  text: string;
  kind: string;
  mine?: boolean;
};

const workspace = {
  id: "totalk",
  short: "T",
  name: "ToTalk",
  subtitle: "Основной workspace",
  tone: "brand",
  channels: ["чат"],
  voiceChannels: ["Голосовой"],
} as const;

type ToTalkAppProps = {
  user: ToTalkUser;
  onLogout: () => Promise<void>;
  onUpdateUser: (user: ToTalkUser) => void;
};

export default function ToTalkApp({ user, onLogout, onUpdateUser }: ToTalkAppProps) {
  const [homeMode, setHomeMode] = useState(true);
  const [channel, setChannel] = useState(workspace.channels[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState<"loading" | "online" | "error">("loading");
  const [sending, setSending] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"channels" | "members" | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const date = useMemo(() => new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }), []);
  const voice = useVoiceChat(workspace.id);

  const loadMessages = useCallback(async () => {
    try {
      const query = new URLSearchParams({ server: workspace.id, channel });
      const response = await fetch(`/api/messages?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("messages unavailable");
      const data = await response.json() as {
        messages: Array<{ id: number; userId: number; author: string; username: string; text: string; kind: string; createdAt: string }>;
      };
      setMessages(data.messages.map((message) => ({
        id: message.id,
        userId: message.userId,
        author: message.author,
        username: message.username,
        avatar: message.author.trim().charAt(0).toUpperCase() || "?",
        time: new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }).format(new Date(`${message.createdAt}Z`)),
        text: message.text,
        kind: message.kind,
        mine: message.userId === user.id,
      })));
      setConnection("online");
    } catch {
      setConnection("error");
    }
  }, [channel, user.id]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMessages(), 0);
    const timer = window.setInterval(() => void loadMessages(), 2000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadMessages]);

  function openWorkspace() {
    setChannel(workspace.channels[0]);
    setHomeMode(false);
    setMobilePanel(null);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    const temporaryId = -Date.now();
    setMessages((current) => [...current, {
      id: temporaryId,
      userId: user.id,
      author: user.displayName,
      username: user.username,
      avatar: user.displayName.charAt(0).toUpperCase() || "В",
      time: date.format(new Date()),
      text,
      kind: "text",
      mine: true,
    }]);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverId: workspace.id, channel, text }),
      });
      if (!response.ok) throw new Error("send failed");
      await loadMessages();
    } catch {
      setMessages((current) => current.filter((message) => message.id !== temporaryId));
      setDraft(text);
      setConnection("error");
    } finally {
      setSending(false);
    }
  }

  async function sendSticker(sticker: Sticker) {
    setShowStickers(false);
    const temporaryId = -Date.now();
    setMessages((current) => [...current, {
      id: temporaryId,
      userId: user.id,
      author: user.displayName,
      username: user.username,
      avatar: user.displayName.charAt(0).toUpperCase() || "В",
      time: date.format(new Date()),
      text: sticker,
      kind: "sticker",
      mine: true,
    }]);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverId: workspace.id, channel, text: sticker, kind: "sticker" }),
      });
      if (!response.ok) throw new Error("send failed");
      await loadMessages();
    } catch {
      setMessages((current) => current.filter((message) => message.id !== temporaryId));
      setConnection("error");
    }
  }

  if (homeMode) {
    return <HomeHub user={user} onLogout={onLogout} onOpenServer={openWorkspace} onUpdateUser={onUpdateUser} />;
  }

  const liveMembers = [
    { key: `self-${user.id}`, avatar: user.displayName.charAt(0).toUpperCase(), name: user.displayName, status: voice.room ? `В голосе: ${voice.room}` : `@${user.username}` },
    ...voice.participants.map((participant) => ({
      key: participant.peerId,
      avatar: participant.displayName.charAt(0).toUpperCase() || "?",
      name: participant.displayName,
      status: `@${participant.username}`,
    })),
  ];

  return (
    <main className="app-shell">
      <nav className="server-rail" aria-label="Серверы">
        <button className="server-icon home-shortcut" onClick={() => setHomeMode(true)} aria-label="Главная">⌂</button>
        <span className="rail-divider" />
        <div className="server-slot">
          <button
            onClick={openWorkspace}
            className="brand-mark active"
            aria-label="Открыть ToTalk"
            aria-pressed="true"
          >{workspace.short}</button>
        </div>
      </nav>

      <aside className={`channel-panel ${mobilePanel === "channels" ? "mobile-open" : ""}`}>
        <div className="workspace-title"><span><b>{workspace.name}</b><small>{workspace.subtitle}</small></span><span className={`connection ${connection}`}>{connection === "online" ? "● онлайн" : connection === "loading" ? "○ вход…" : "● нет связи"}</span></div>
        <div className="channel-scroll">
          <div className="section-label"><span>ТЕКСТОВЫЕ КАНАЛЫ</span></div>
          {workspace.channels.map((item) => <button key={item} onClick={() => { setChannel(item); setMobilePanel(null); }} className={`channel ${channel === item ? "selected" : ""}`}><span>#</span>{item}</button>)}
          <div className="section-label"><span>ГОЛОСОВЫЕ КАНАЛЫ</span></div>
          {workspace.voiceChannels.map((item) => <button key={item} onClick={() => void voice.join(item)} className={`channel ${voice.room === item ? "selected voice-active" : ""}`}><span>♫</span>{item}{voice.room === item && <em>{voice.participantCount}</em>}</button>)}
          {voice.room && <div className="voice-users"><span className="mini-avatar">{user.displayName.charAt(0).toUpperCase()}</span><div><b>{user.displayName}</b><small>{voice.status === "joining" ? "Подключение…" : `${voice.participantCount} в эфире`}</small></div></div>}
          {voice.room && voice.participants.map((participant) => (
            <div className="voice-users remote-voice-user" key={participant.peerId}>
              <span className="mini-avatar">{participant.displayName.charAt(0).toUpperCase() || "?"}</span>
              <div><b>{participant.displayName}</b><small>@{participant.username} · в эфире</small></div>
              <i className="voice-live-dot" aria-label="Подключён" />
            </div>
          ))}
          {voice.room && voice.status === "connected" && voice.participants.length === 0 && <div className="voice-empty">Пока вы один в комнате</div>}
          {voice.error && <div className="voice-error">{voice.error}</div>}
        </div>
        <div className="user-bar"><button className="user-bar-identity" onClick={() => setShowProfile(true)} aria-label="Открыть профиль"><span className="avatar self">{user.displayName.charAt(0).toUpperCase()}<i /></span><span><b>{user.displayName}</b><small>{voice.room ? `Голос: ${voice.room}` : `@${user.username}`}</small></span></button>{voice.room && <><button onClick={voice.toggleMute} aria-label={voice.muted ? "Включить микрофон" : "Выключить микрофон"}>{voice.muted ? "⊘" : "●"}</button><button onClick={() => void voice.leave()} aria-label="Покинуть голосовой канал">☎</button></>}<button onClick={() => void onLogout()} aria-label="Выйти">↪</button></div>
        {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSaved={onUpdateUser} />}
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <button className="mobile-menu" onClick={() => setMobilePanel(mobilePanel === "channels" ? null : "channels")} aria-label="Открыть каналы">☰</button>
          <span className="hash">#</span><b>{channel}</b><span className="header-divider" /><small>Общайтесь, делитесь идеями и будьте на связи</small>
          <div className="header-actions"><button aria-label="Звонок">☎</button><button aria-label="Поиск">⌕</button><button onClick={() => setMobilePanel(mobilePanel === "members" ? null : "members")} aria-label="Участники">☷</button></div>
        </header>

        <div className="message-scroll">
          <div className="channel-intro"><div>#</div><h1>Добро пожаловать в #{channel}!</h1><p>Это начало канала #{channel}.</p></div>
          <div className="day-divider"><span>Сегодня</span></div>
          {messages.map((message) => (
            <article className={`message ${message.mine ? "mine" : ""} ${message.kind === "sticker" ? "sticker-message" : ""}`} key={message.id}>
              <span className={`avatar avatar-${message.avatar.charCodeAt(0) % 4}`}>{message.avatar}</span>
              <div>
                <div className="message-meta"><b>{message.author}</b><time>{message.time}</time></div>
                {message.kind === "sticker" ? <span className="sticker-bubble">{message.text}</span> : <p>{message.text}</p>}
              </div>
            </article>
          ))}
        </div>
        <form className="composer" onSubmit={sendMessage}>
          <button type="button" aria-label="Добавить">+</button>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Написать #${channel}`} aria-label="Сообщение" />
          <div className="sticker-anchor">
            <button type="button" aria-label="Стикеры" aria-pressed={showStickers} onClick={() => setShowStickers((open) => !open)}>☺</button>
            {showStickers && <StickerPicker onPick={(sticker) => void sendSticker(sticker)} onClose={() => setShowStickers(false)} />}
          </div>
          <button className="send" aria-label="Отправить" disabled={sending}>↑</button>
        </form>
      </section>

      <aside className={`member-panel ${mobilePanel === "members" ? "mobile-open" : ""}`}>
        <div className="member-title">УЧАСТНИКИ — {liveMembers.length}</div>
        {liveMembers.map((member) => <button className="member" key={member.key}><span className={`avatar avatar-${member.avatar.charCodeAt(0) % 4}`}>{member.avatar}<i /></span><span><b>{member.name}</b><small>{member.status}</small></span></button>)}
      </aside>
      {mobilePanel && <button className="scrim" onClick={() => setMobilePanel(null)} aria-label="Закрыть панель" />}
      {voice.room && (
        <VoiceCallOverlay
          title={`♫ ${voice.room}`}
          subtitle={voice.status === "joining" ? "Подключение…" : `${voice.participantCount} в эфире`}
          error={voice.error}
          selfName={user.displayName}
          participants={voice.participants}
          localStream={voice.localStream}
          remoteStreams={voice.remoteStreams}
          cameraOn={voice.cameraOn}
          muted={voice.muted}
          onToggleMute={voice.toggleMute}
          onToggleCamera={voice.toggleCamera}
          onLeave={() => void voice.leave()}
        />
      )}
    </main>
  );
}
