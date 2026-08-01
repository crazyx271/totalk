"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import HomeHub from "./HomeHub";
import VoiceCallOverlay from "./VoiceCallOverlay";
import StickerPicker from "./StickerPicker";
import ProfileModal from "./ProfileModal";
import SettingsModal from "./SettingsModal";
import Avatar from "./Avatar";
import { useVoiceChat } from "./useVoiceChat";
import { playConnectTone, playEndTone, startRingtone, stopRingtone } from "./callSounds";
import type { Sticker } from "./stickers";
import type { ToTalkUser } from "./page";
import type { DirectCall, Friend } from "./callTypes";
import { DownloadIcon, LogOutIcon, MenuIcon, PhoneIcon, PlusIcon, SearchIcon, SendIcon, SettingsIcon, SmileIcon, UsersIcon } from "./Icons";
import { useIsDesktopApp } from "./useIsDesktopApp";
import { MicIcon, MicOffIcon, PhoneOffIcon } from "./CallIcons";

type Message = {
  id: number;
  userId?: number;
  author: string;
  username?: string;
  avatar: string;
  avatarPath: string | null;
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
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState<"loading" | "online" | "error">("loading");
  const [sending, setSending] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"channels" | "members" | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const date = useMemo(() => new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }), []);
  const voice = useVoiceChat(workspace.id);
  const isDesktop = useIsDesktopApp();

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  // Direct (1:1) call state lives here — not inside HomeHub — so it survives
  // switching between the home/DM view and the group workspace view. HomeHub
  // used to own this, which meant it (and the WebRTC connection with it) got
  // torn down the moment you navigated away to read messages elsewhere.
  const dmVoice = useVoiceChat("dm");
  const [incomingCall, setIncomingCall] = useState<DirectCall | null>(null);
  const [activeCall, setActiveCall] = useState<DirectCall | null>(null);
  const [focusFriendId, setFocusFriendId] = useState<number | null>(null);
  const leaveDmVoice = dmVoice.leave;
  const dmVoiceRoom = dmVoice.room;

  const loadMessages = useCallback(async () => {
    try {
      const query = new URLSearchParams({ server: workspace.id, channel });
      const response = await fetch(`/api/messages?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("messages unavailable");
      const data = await response.json() as {
        messages: Array<{ id: number; userId: number; author: string; username: string; avatarPath: string | null; text: string; kind: string; createdAt: string }>;
      };
      setMessages(data.messages.map((message) => ({
        id: message.id,
        userId: message.userId,
        author: message.author,
        username: message.username,
        avatar: message.author.trim().charAt(0).toUpperCase() || "?",
        avatarPath: message.avatarPath,
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

  useEffect(() => {
    const ping = () => void fetch("/api/presence", { method: "POST" });
    ping();
    const timer = window.setInterval(ping, 25_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadCalls = useCallback(async () => {
    const response = await fetch("/api/calls", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { calls: DirectCall[] };
    setIncomingCall(data.calls.find((call) => call.incoming && call.status === "ringing") ?? null);
    setActiveCall((current) => {
      if (!current) return null;
      const updated = data.calls.find((call) => call.id === current.id) ?? null;
      if (!updated) {
        if (dmVoiceRoom) void leaveDmVoice();
        playEndTone();
      }
      return updated;
    });
  }, [leaveDmVoice, dmVoiceRoom]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadCalls(), 0);
    const timer = window.setInterval(() => void loadCalls(), 1500);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadCalls]);

  useEffect(() => {
    if (incomingCall) startRingtone();
    else stopRingtone();
    return stopRingtone;
  }, [incomingCall]);

  const connectedToneRef = useRef(false);
  useEffect(() => {
    if (activeCall && dmVoice.participantCount > 1) {
      if (!connectedToneRef.current) {
        connectedToneRef.current = true;
        playConnectTone();
      }
    } else if (!activeCall) {
      connectedToneRef.current = false;
    }
  }, [activeCall, dmVoice.participantCount]);

  async function startCall(friend: Friend) {
    const response = await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start", friendId: friend.id }),
    });
    const data = await response.json() as { call?: DirectCall; error?: string };
    if (!response.ok || !data.call) {
      return data.error ?? "Не удалось начать звонок";
    }
    setActiveCall({ ...data.call, incoming: false, person: friend });
    await dmVoice.join(data.call.room);
    return null;
  }

  async function acceptCall(call: DirectCall) {
    const response = await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "accept", callId: call.id }),
    });
    if (!response.ok) {
      setIncomingCall(null);
      return;
    }
    setIncomingCall(null);
    setActiveCall({ ...call, status: "accepted" });
    setFocusFriendId(call.person.id);
    await dmVoice.join(call.room);
  }

  async function finishCall(call: DirectCall, action: "decline" | "end") {
    await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, callId: call.id }),
    });
    if (incomingCall?.id === call.id) setIncomingCall(null);
    if (activeCall?.id === call.id) {
      setActiveCall(null);
      playEndTone();
    }
    await dmVoice.leave();
  }

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
      avatarPath: user.avatarPath,
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
      avatarPath: user.avatarPath,
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

  const callToastAndOverlay = (
    <>
      {incomingCall && <div className="call-toast">
        <Avatar name={incomingCall.person.displayName} avatarPath={incomingCall.person.avatarPath} className="friend-avatar" />
        <div><small>ВХОДЯЩИЙ ЗВОНОК</small><b>{incomingCall.person.displayName}</b></div>
        <button className="accept-call" onClick={() => void acceptCall(incomingCall)} aria-label="Принять звонок"><PhoneIcon /></button>
        <button className="decline-call" onClick={() => void finishCall(incomingCall, "decline")} aria-label="Отклонить звонок"><PhoneOffIcon /></button>
      </div>}
      {activeCall && (
        <VoiceCallOverlay
          title={activeCall.person.displayName}
          subtitle={activeCall.status === "ringing" ? "Звоним…" : dmVoice.participantCount > 1 ? "Голосовая связь установлена" : "Подключение…"}
          error={dmVoice.error}
          selfName={user.displayName}
          selfAvatarPath={user.avatarPath}
          participants={dmVoice.participants}
          localStream={dmVoice.localStream}
          remoteStreams={dmVoice.remoteStreams}
          cameraOn={dmVoice.cameraOn}
          screenSharing={dmVoice.screenSharing}
          muted={dmVoice.muted}
          onToggleMute={dmVoice.toggleMute}
          onToggleCamera={dmVoice.toggleCamera}
          onToggleScreenShare={dmVoice.toggleScreenShare}
          onLeave={() => void finishCall(activeCall, "end")}
        />
      )}
    </>
  );

  if (homeMode) {
    return (
      <>
        <HomeHub
          user={user}
          onLogout={onLogout}
          onOpenServer={openWorkspace}
          onUpdateUser={onUpdateUser}
          activeCall={activeCall}
          onStartCall={startCall}
          focusFriendId={focusFriendId}
          onFocusHandled={() => setFocusFriendId(null)}
        />
        {callToastAndOverlay}
      </>
    );
  }

  const liveMembers = [
    { key: `self-${user.id}`, name: user.displayName, avatarPath: user.avatarPath, status: voice.room ? `В голосе: ${voice.room}` : `@${user.username}` },
    ...voice.participants.map((participant) => ({
      key: participant.peerId,
      name: participant.displayName,
      avatarPath: participant.avatarPath,
      status: `@${participant.username}`,
    })),
  ];

  return (
    <>
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
            {voice.room && <div className="voice-users"><Avatar name={user.displayName} avatarPath={user.avatarPath} className="mini-avatar" /><div><b>{user.displayName}</b><small>{voice.status === "joining" ? "Подключение…" : `${voice.participantCount} в эфире`}</small></div></div>}
            {voice.room && voice.participants.map((participant) => (
              <div className="voice-users remote-voice-user" key={participant.peerId}>
                <Avatar name={participant.displayName} avatarPath={participant.avatarPath} className="mini-avatar" />
                <div><b>{participant.displayName}</b><small>@{participant.username} · в эфире</small></div>
                <i className="voice-live-dot" aria-label="Подключён" />
              </div>
            ))}
            {voice.room && voice.status === "connected" && voice.participants.length === 0 && <div className="voice-empty">Пока вы один в комнате</div>}
            {voice.error && <div className="voice-error">{voice.error}</div>}
          </div>
          <div className="user-bar"><button className="user-bar-identity" onClick={() => setShowProfile(true)} aria-label="Открыть профиль"><Avatar name={user.displayName} avatarPath={user.avatarPath} className="avatar self"><i /></Avatar><span><b>{user.displayName}</b><small>{voice.room ? `Голос: ${voice.room}` : `@${user.username}`}</small></span></button>{voice.room && <><button onClick={voice.toggleMute} aria-label={voice.muted ? "Включить микрофон" : "Выключить микрофон"}>{voice.muted ? <MicOffIcon /> : <MicIcon />}</button><button onClick={() => void voice.leave()} aria-label="Покинуть голосовой канал"><PhoneOffIcon /></button></>}{!isDesktop && <a href="/downloads/ToTalk-Setup.exe" download aria-label="Скачать для Windows"><DownloadIcon /></a>}<button onClick={() => setShowSettings(true)} aria-label="Настройки"><SettingsIcon /></button><button onClick={() => void onLogout()} aria-label="Выйти"><LogOutIcon /></button></div>
          {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSaved={onUpdateUser} />}
          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </aside>

        <section className="chat-panel">
          <header className="chat-header">
            <button className="mobile-menu" onClick={() => setMobilePanel(mobilePanel === "channels" ? null : "channels")} aria-label="Открыть каналы"><MenuIcon /></button>
            <span className="hash">#</span><b>{channel}</b><span className="header-divider" /><small>Общайтесь, делитесь идеями и будьте на связи</small>
            <div className="header-actions"><button aria-label="Поиск"><SearchIcon /></button><button onClick={() => setMobilePanel(mobilePanel === "members" ? null : "members")} aria-label="Участники"><UsersIcon /></button></div>
          </header>

          <div className="message-scroll" ref={messagesRef}>
            <div className="channel-intro"><div>#</div><h1>Добро пожаловать в #{channel}!</h1><p>Это начало канала #{channel}.</p></div>
            <div className="day-divider"><span>Сегодня</span></div>
            {messages.map((message) => (
              <article className={`message ${message.mine ? "mine" : ""} ${message.kind === "sticker" ? "sticker-message" : ""}`} key={message.id}>
                <Avatar name={message.author} avatarPath={message.avatarPath} className={`avatar avatar-${message.avatar.charCodeAt(0) % 4}`} />
                <div>
                  <div className="message-meta"><b>{message.author}</b><time>{message.time}</time></div>
                  {message.kind === "sticker" ? <span className="sticker-bubble">{message.text}</span> : <p>{message.text}</p>}
                </div>
              </article>
            ))}
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <button type="button" aria-label="Добавить"><PlusIcon /></button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Написать #${channel}`} aria-label="Сообщение" />
            <div className="sticker-anchor">
              <button type="button" aria-label="Стикеры" aria-pressed={showStickers} onClick={() => setShowStickers((open) => !open)}><SmileIcon /></button>
              {showStickers && <StickerPicker onPick={(sticker) => void sendSticker(sticker)} onClose={() => setShowStickers(false)} />}
            </div>
            <button className="send" aria-label="Отправить" disabled={sending}><SendIcon /></button>
          </form>
        </section>

        <aside className={`member-panel ${mobilePanel === "members" ? "mobile-open" : ""}`}>
          <div className="member-title">УЧАСТНИКИ — {liveMembers.length}</div>
          {liveMembers.map((member) => <button className="member" key={member.key}><Avatar name={member.name} avatarPath={member.avatarPath} className={`avatar avatar-${member.name.charCodeAt(0) % 4}`}><i /></Avatar><span><b>{member.name}</b><small>{member.status}</small></span></button>)}
        </aside>
        {mobilePanel && <button className="scrim" onClick={() => setMobilePanel(null)} aria-label="Закрыть панель" />}
        {voice.room && (
          <VoiceCallOverlay
            title={`♫ ${voice.room}`}
            subtitle={voice.status === "joining" ? "Подключение…" : `${voice.participantCount} в эфире`}
            error={voice.error}
            selfName={user.displayName}
            selfAvatarPath={user.avatarPath}
            participants={voice.participants}
            localStream={voice.localStream}
            remoteStreams={voice.remoteStreams}
            cameraOn={voice.cameraOn}
            screenSharing={voice.screenSharing}
            muted={voice.muted}
            onToggleMute={voice.toggleMute}
            onToggleCamera={voice.toggleCamera}
            onToggleScreenShare={voice.toggleScreenShare}
            onLeave={() => void voice.leave()}
          />
        )}
      </main>
      {callToastAndOverlay}
    </>
  );
}
