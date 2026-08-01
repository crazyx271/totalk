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
import type { CommunityServer, DirectCall, Friend } from "./callTypes";
import { DownloadIcon, LogOutIcon, MenuIcon, PaperclipIcon, PhoneIcon, PlusIcon, SearchIcon, SendIcon, SettingsIcon, SmileIcon, UsersIcon, XIcon } from "./Icons";
import { useIsDesktopApp } from "./useIsDesktopApp";
import { MicIcon, MicOffIcon, PhoneOffIcon } from "./CallIcons";
import { enableBrowserNotifications, showToTalkNotification } from "./notifications";
import { serverHueClass } from "./serverHue";

type Message = {
  id: number;
  userId?: number;
  author: string;
  username?: string;
  avatar: string;
  avatarPath: string | null;
  avatarFrame: string | null;
  time: string;
  createdAtMs: number;
  text: string;
  kind: string;
  fileName?: string | null;
  fileMime?: string | null;
  fileSize?: number | null;
  stickerId?: number;
  mine?: boolean;
};

const EMPTY_WORKSPACE = { id: "none", short: "?", name: "Группа", subtitle: "", channels: [] as string[], voiceChannels: [] as string[] };

type ToTalkAppProps = {
  user: ToTalkUser;
  onLogout: () => Promise<void>;
  onUpdateUser: (user: ToTalkUser) => void;
};

export default function ToTalkApp({ user, onLogout, onUpdateUser }: ToTalkAppProps) {
  const [homeMode, setHomeMode] = useState(true);
  const [servers, setServers] = useState<CommunityServer[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [creatingServer, setCreatingServer] = useState(false);
  const [serverError, setServerError] = useState("");
  const [showCreateChannel, setShowCreateChannel] = useState<"text" | "voice" | null>(null);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelError, setChannelError] = useState("");
  const activeServer = servers.find((server) => server.id === activeServerId) ?? null;
  const workspace = activeServer ? {
    id: activeServer.id,
    short: activeServer.name.trim().charAt(0).toUpperCase() || "?",
    name: activeServer.name,
    subtitle: activeServer.ownerId === user.id ? "Ваша группа" : "Сообщество",
    channels: activeServer.channels.filter((item) => item.kind === "text").map((item) => item.name),
    voiceChannels: activeServer.channels.filter((item) => item.kind === "voice").map((item) => item.name),
  } : EMPTY_WORKSPACE;
  const [channel, setChannel] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const channelFileRef = useRef<HTMLInputElement | null>(null);
  const temporaryMessageIdRef = useRef(-1);
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

  const loadServers = useCallback(async () => {
    const response = await fetch("/api/servers", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { servers: CommunityServer[] };
    setServers(data.servers);
    if (activeServerId && !data.servers.some((server) => server.id === activeServerId)) {
      setActiveServerId(null);
      setHomeMode(true);
    }
  }, [activeServerId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadServers(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadServers]);

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
  const [selectedDmFriendId, setSelectedDmFriendId] = useState<number | null>(null);
  const notificationCursorRef = useRef<number | null>(null);
  const leaveDmVoice = dmVoice.leave;
  const dmVoiceRoom = dmVoice.room;

  useEffect(() => {
    const enable = () => { void enableBrowserNotifications(); };
    window.addEventListener("pointerdown", enable, { once: true });
    return () => window.removeEventListener("pointerdown", enable);
  }, []);

  useEffect(() => {
    let disposed = false;
    const poll = async () => {
      try {
        const after = notificationCursorRef.current;
        const response = await fetch(`/api/notifications${after ? `?after=${after}` : ""}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { cursor: number; items: Array<{ id: number; senderId: number; author: string; text: string; kind: string }> };
        if (disposed) return;
        notificationCursorRef.current = data.cursor;
        for (const item of data.items) {
          const body = item.kind === "sticker" ? `Стикер ${item.text}` : item.kind === "file" ? `Файл: ${item.text}` : item.text;
          void showToTalkNotification(item.author, body, () => { setHomeMode(true); setFocusFriendId(item.senderId); });
        }
      } catch {
        // The next polling cycle will retry.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2200);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  const loadMessages = useCallback(async () => {
    if (!activeServerId || !channel) return;
    try {
      const query = new URLSearchParams({ server: activeServerId, channel });
      const response = await fetch(`/api/messages?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("messages unavailable");
      const data = await response.json() as {
        messages: Array<{ id: number; userId: number; author: string; username: string; avatarPath: string | null; avatarFrame: string | null; text: string; kind: string; fileName: string | null; fileMime: string | null; fileSize: number | null; createdAt: string }>;
      };
      setMessages(data.messages.map((message) => ({
        id: message.id,
        userId: message.userId,
        author: message.author,
        username: message.username,
        avatar: message.author.trim().charAt(0).toUpperCase() || "?",
        avatarPath: message.avatarPath,
        avatarFrame: message.avatarFrame,
        time: new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }).format(new Date(`${message.createdAt}Z`)),
        createdAtMs: new Date(`${message.createdAt}Z`).getTime(),
        text: message.text,
        kind: message.kind,
        fileName: message.fileName,
        fileMime: message.fileMime,
        fileSize: message.fileSize,
        mine: message.userId === user.id,
      })));
      setConnection("online");
    } catch {
      setConnection("error");
    }
  }, [activeServerId, channel, user.id]);

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

  function openWorkspace(server: CommunityServer) {
    const firstTextChannel = server.channels.find((item) => item.kind === "text")?.name ?? "";
    setActiveServerId(server.id);
    setChannel(firstTextChannel);
    setHomeMode(false);
    setMobilePanel(null);
  }

  async function createServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingServer(true);
    setServerError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/servers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: String(form.get("name") ?? "") }) });
      const data = await response.json() as { server?: CommunityServer; error?: string };
      if (!response.ok || !data.server) throw new Error(data.error ?? "Не удалось создать группу");
      setServers((current) => [...current, data.server!]);
      setShowCreateServer(false);
      openWorkspace(data.server);
    } catch (createError) {
      setServerError(createError instanceof Error ? createError.message : "Не удалось создать группу");
    } finally {
      setCreatingServer(false);
    }
  }

  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeServer || !showCreateChannel) return;
    setCreatingChannel(true);
    setChannelError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/servers/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverId: activeServer.id, name: String(form.get("name") ?? ""), kind: showCreateChannel }),
      });
      const data = await response.json() as { channel?: { id?: number; name: string; kind: string }; error?: string };
      if (!response.ok || !data.channel) throw new Error(data.error ?? "Не удалось создать канал");
      const newChannel = data.channel;
      setServers((current) => current.map((server) => server.id === activeServer.id ? { ...server, channels: [...server.channels, newChannel] } : server));
      if (showCreateChannel === "text") setChannel(newChannel.name);
      setShowCreateChannel(null);
    } catch (createError) {
      setChannelError(createError instanceof Error ? createError.message : "Не удалось создать канал");
    } finally {
      setCreatingChannel(false);
    }
  }

  async function deleteActiveServer() {
    if (!activeServer || activeServer.ownerId !== user.id) return;
    if (!window.confirm(`Удалить группу «${activeServer.name}»? Сообщения группы будут удалены.`)) return;
    const response = await fetch(`/api/servers?id=${encodeURIComponent(activeServer.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setConnection("error");
      return;
    }
    if (voice.room) await voice.leave();
    setServers((current) => current.filter((server) => server.id !== activeServer.id));
    setActiveServerId(null);
    setChannel("");
    setHomeMode(true);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    const temporaryId = temporaryMessageIdRef.current--;
    setMessages((current) => [...current, {
      id: temporaryId,
      userId: user.id,
      author: user.displayName,
      username: user.username,
      avatar: user.displayName.charAt(0).toUpperCase() || "В",
      avatarPath: user.avatarPath,
      avatarFrame: user.avatarFrame,
      time: date.format(new Date()),
      createdAtMs: Date.now(),
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
    const temporaryId = temporaryMessageIdRef.current--;
    setMessages((current) => [...current, {
      id: temporaryId,
      userId: user.id,
      author: user.displayName,
      username: user.username,
      avatar: user.displayName.charAt(0).toUpperCase() || "В",
      avatarPath: user.avatarPath,
      avatarFrame: user.avatarFrame,
      time: date.format(new Date()),
      createdAtMs: Date.now(),
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

  async function sendImageSticker(stickerId: number) {
    setShowStickers(false);
    const temporaryId = temporaryMessageIdRef.current--;
    setMessages((current) => [...current, {
      id: temporaryId,
      userId: user.id,
      author: user.displayName,
      username: user.username,
      avatar: user.displayName.charAt(0).toUpperCase() || "В",
      avatarPath: user.avatarPath,
      avatarFrame: user.avatarFrame,
      time: date.format(new Date()),
      createdAtMs: Date.now(),
      text: "Стикер",
      kind: "sticker",
      stickerId,
      mine: true,
    }]);
    try {
      const response = await fetch("/api/stickers/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "channel", serverId: workspace.id, channel, stickerId }),
      });
      if (!response.ok) throw new Error("send failed");
      await loadMessages();
    } catch {
      setMessages((current) => current.filter((message) => message.id !== temporaryId));
      setConnection("error");
    }
  }

  async function sendChannelFile(file: File) {
    if (sending) return;
    setSending(true);
    const form = new FormData();
    form.append("scope", "channel");
    form.append("serverId", workspace.id);
    form.append("channel", channel);
    form.append("file", file);
    try {
      const response = await fetch("/api/files", { method: "POST", body: form });
      if (!response.ok) throw new Error("upload failed");
      await loadMessages();
    } catch {
      setConnection("error");
    } finally {
      setSending(false);
      if (channelFileRef.current) channelFileRef.current.value = "";
    }
  }

  const dmCallView = activeCall ? (
    <VoiceCallOverlay
      variant="embedded"
      title={activeCall.person.displayName}
      subtitle={activeCall.status === "ringing" ? "Звоним…" : dmVoice.participantCount > 1 ? "Голосовая связь установлена" : "Подключение…"}
      error={dmVoice.error}
      selfName={user.displayName}
      selfAvatarPath={user.avatarPath}
      selfAvatarFrame={user.avatarFrame}
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
  ) : null;

  const callToastAndDock = (
    <>
      {incomingCall && <div className="call-toast">
        <Avatar name={incomingCall.person.displayName} avatarPath={incomingCall.person.avatarPath} avatarFrame={incomingCall.person.avatarFrame} className="friend-avatar" />
        <div><small>ВХОДЯЩИЙ ЗВОНОК</small><b>{incomingCall.person.displayName}</b></div>
        <button className="accept-call" onClick={() => void acceptCall(incomingCall)} aria-label="Принять звонок"><PhoneIcon /></button>
        <button className="decline-call" onClick={() => void finishCall(incomingCall, "decline")} aria-label="Отклонить звонок"><PhoneOffIcon /></button>
      </div>}
      {activeCall && (!homeMode || selectedDmFriendId !== activeCall.person.id) && <div className="compact-call-dock">
        <button type="button" className="compact-call-main" onClick={() => { setHomeMode(true); setFocusFriendId(activeCall.person.id); }}>
          <Avatar name={activeCall.person.displayName} avatarPath={activeCall.person.avatarPath} avatarFrame={activeCall.person.avatarFrame} className="friend-avatar small" />
          <span><small>ТЕКУЩИЙ ЗВОНОК</small><b>{activeCall.person.displayName}</b></span>
        </button>
        <button type="button" onClick={dmVoice.toggleMute} aria-label={dmVoice.muted ? "Включить микрофон" : "Выключить микрофон"}>{dmVoice.muted ? <MicOffIcon /> : <MicIcon />}</button>
        <button type="button" className="danger" onClick={() => void finishCall(activeCall, "end")} aria-label="Завершить звонок"><PhoneOffIcon /></button>
      </div>}
    </>
  );

  const createServerModal = showCreateServer ? (
    <div className="modal-scrim" onClick={() => setShowCreateServer(false)}>
      <section className="modal-card create-server-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setShowCreateServer(false)} aria-label="Закрыть"><XIcon /></button>
        <span className="create-server-icon"><PlusIcon /></span>
        <h2>Создать свою группу</h2>
        <p>Название можно будет изменить позже. Мы сразу добавим текстовый и голосовой канал.</p>
        <form onSubmit={createServer}>
          <label>Название группы<input name="name" minLength={2} maxLength={32} required autoFocus placeholder="Например, Ночная команда" /></label>
          {serverError && <div className="auth-error">{serverError}</div>}
          <button className="auth-submit" disabled={creatingServer}>{creatingServer ? "Создаём…" : "Создать группу"}</button>
        </form>
      </section>
    </div>
  ) : null;

  const createChannelModal = showCreateChannel ? (
    <div className="modal-scrim" onClick={() => setShowCreateChannel(null)}>
      <section className="modal-card create-server-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setShowCreateChannel(null)} aria-label="Закрыть"><XIcon /></button>
        <span className="create-server-icon"><PlusIcon /></span>
        <h2>{showCreateChannel === "text" ? "Новый текстовый канал" : "Новый голосовой канал"}</h2>
        <p>Канал появится в списке сразу после создания.</p>
        <form onSubmit={createChannel}>
          <label>Название канала<input name="name" minLength={1} maxLength={32} required autoFocus placeholder={showCreateChannel === "text" ? "например, мемы" : "например, созвон"} /></label>
          {channelError && <div className="auth-error">{channelError}</div>}
          <button className="auth-submit" disabled={creatingChannel}>{creatingChannel ? "Создаём…" : "Создать канал"}</button>
        </form>
      </section>
    </div>
  ) : null;

  if (homeMode || !activeServer) {
    return (
      <>
        <HomeHub
          user={user}
          servers={servers}
          onLogout={onLogout}
          onOpenServer={openWorkspace}
          onCreateServer={() => { setServerError(""); setShowCreateServer(true); }}
          onUpdateUser={onUpdateUser}
          activeCall={activeCall}
          onStartCall={startCall}
          focusFriendId={focusFriendId}
          onFocusHandled={() => setFocusFriendId(null)}
          onConversationChange={setSelectedDmFriendId}
          callPanel={activeCall && selectedDmFriendId === activeCall.person.id ? dmCallView : undefined}
        />
        {callToastAndDock}
        {createServerModal}
        {createChannelModal}
      </>
    );
  }

  const liveMembers = [
    { key: `self-${user.id}`, name: user.displayName, avatarPath: user.avatarPath, avatarFrame: user.avatarFrame, status: voice.room ? `В голосе: ${voice.room}` : `@${user.username}` },
    ...voice.participants.map((participant) => ({
      key: participant.peerId,
      name: participant.displayName,
      avatarPath: participant.avatarPath,
      avatarFrame: participant.avatarFrame,
      status: `@${participant.username}`,
    })),
  ];

  return (
    <>
      <main className="app-shell">
        <nav className="server-rail" aria-label="Серверы">
          <button className="server-icon home-shortcut" onClick={() => setHomeMode(true)} aria-label="Главная">⌂</button>
          <span className="rail-divider" />
          {servers.map((server) => <div className="server-slot" key={server.id}><button onClick={() => openWorkspace(server)} className={`server-icon ${serverHueClass(server.id)} ${server.id === activeServerId ? "active" : ""}`} aria-label={`Открыть группу ${server.name}`} aria-pressed={server.id === activeServerId}>{server.name.trim().charAt(0).toUpperCase()}</button></div>)}
          <button className="server-icon add" onClick={() => { setServerError(""); setShowCreateServer(true); }} aria-label="Создать группу"><PlusIcon /></button>
        </nav>

        <aside className={`channel-panel ${mobilePanel === "channels" ? "mobile-open" : ""}`}>
          <div className="workspace-title"><span><b>{workspace.name}</b><small>{workspace.subtitle}</small></span><div className="workspace-actions"><span className={`connection ${connection}`}>{connection === "online" ? "● онлайн" : connection === "loading" ? "○ вход…" : "● нет связи"}</span>{activeServer.ownerId === user.id && <button type="button" className="delete-server-button" onClick={() => void deleteActiveServer()} aria-label="Удалить группу" title="Удалить группу"><XIcon /></button>}</div></div>
          <div className="channel-scroll">
            <div className="section-label"><span>ТЕКСТОВЫЕ КАНАЛЫ</span>{activeServer.ownerId === user.id && <button type="button" onClick={() => { setChannelError(""); setShowCreateChannel("text"); }} aria-label="Добавить текстовый канал"><PlusIcon /></button>}</div>
            {workspace.channels.map((item) => <button key={item} onClick={() => { setChannel(item); setMobilePanel(null); }} className={`channel ${channel === item ? "selected" : ""}`}><span>#</span>{item}</button>)}
            <div className="section-label"><span>ГОЛОСОВЫЕ КАНАЛЫ</span>{activeServer.ownerId === user.id && <button type="button" onClick={() => { setChannelError(""); setShowCreateChannel("voice"); }} aria-label="Добавить голосовой канал"><PlusIcon /></button>}</div>
            {workspace.voiceChannels.map((item) => <button key={item} onClick={() => void voice.join(item)} className={`channel ${voice.room === item ? "selected voice-active" : ""}`}><span>♫</span>{item}{voice.room === item && <em>{voice.participantCount}</em>}</button>)}
            {voice.room && <div className="voice-users"><Avatar name={user.displayName} avatarPath={user.avatarPath} avatarFrame={user.avatarFrame} className="mini-avatar" /><div><b>{user.displayName}</b><small>{voice.status === "joining" ? "Подключение…" : `${voice.participantCount} в эфире`}</small></div></div>}
            {voice.room && voice.participants.map((participant) => (
              <div className="voice-users remote-voice-user" key={participant.peerId}>
                <Avatar name={participant.displayName} avatarPath={participant.avatarPath} avatarFrame={participant.avatarFrame} className="mini-avatar" />
                <div><b>{participant.displayName}</b><small>@{participant.username} · в эфире</small></div>
                <i className="voice-live-dot" aria-label="Подключён" />
              </div>
            ))}
            {voice.room && voice.status === "connected" && voice.participants.length === 0 && <div className="voice-empty">Пока вы один в комнате</div>}
            {voice.error && <div className="voice-error">{voice.error}</div>}
          </div>
          <div className="user-bar"><button className="user-bar-identity" onClick={() => setShowProfile(true)} aria-label="Открыть профиль"><Avatar name={user.displayName} avatarPath={user.avatarPath} avatarFrame={user.avatarFrame} className="avatar self"><i /></Avatar><span><b>{user.displayName}</b><small>{voice.room ? `Голос: ${voice.room}` : `@${user.username}`}</small></span></button>{voice.room && <><button onClick={voice.toggleMute} aria-label={voice.muted ? "Включить микрофон" : "Выключить микрофон"}>{voice.muted ? <MicOffIcon /> : <MicIcon />}</button><button onClick={() => void voice.leave()} aria-label="Покинуть голосовой канал"><PhoneOffIcon /></button></>}{!isDesktop && <a href="/downloads/ToTalk-Setup.exe" download aria-label="Скачать для Windows"><DownloadIcon /></a>}<button onClick={() => setShowSettings(true)} aria-label="Настройки"><SettingsIcon /></button><button onClick={() => void onLogout()} aria-label="Выйти"><LogOutIcon /></button></div>
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
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const grouped = Boolean(previous && previous.userId !== undefined && previous.userId === message.userId && message.createdAtMs - previous.createdAtMs < 5 * 60_000);
              return (
              <article className={`message ${message.mine ? "mine" : ""} ${message.kind === "sticker" ? "sticker-message" : ""} ${grouped ? "grouped" : ""}`} key={message.id}>
                {grouped ? <time className="message-hover-time">{message.time}</time> : <Avatar name={message.author} avatarPath={message.avatarPath} avatarFrame={message.avatarFrame} className={`avatar avatar-${message.avatar.charCodeAt(0) % 4}`} />}
                <div>
                  {!grouped && <div className="message-meta"><b>{message.author}</b><time>{message.time}</time></div>}
                  {message.kind === "sticker" ? (
                    message.fileMime || message.stickerId ? (
                      <img className="sticker-bubble-image" src={message.fileMime ? `/api/files/channel/${message.id}` : `/api/stickers/image/${message.stickerId}`} alt="Стикер" />
                    ) : <span className="sticker-bubble">{message.text}</span>
                  ) : message.kind === "file" ? (
                    <a className="file-card" href={`/api/files/channel/${message.id}`} download><span><PaperclipIcon /></span><div><b>{message.fileName ?? message.text}</b><small>{message.fileSize ? `${(message.fileSize / 1024 / 1024).toFixed(1)} МБ` : "Файл"}</small></div><DownloadIcon /></a>
                  ) : <p>{message.text}</p>}
                </div>
              </article>
              );
            })}
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <input ref={channelFileRef} className="visually-hidden" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void sendChannelFile(file); }} />
            <button type="button" onClick={() => channelFileRef.current?.click()} aria-label="Отправить файл"><PaperclipIcon /></button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Написать #${channel}`} aria-label="Сообщение" />
            <div className="sticker-anchor">
              <button type="button" aria-label="Стикеры" aria-pressed={showStickers} onClick={() => setShowStickers((open) => !open)}><SmileIcon /></button>
              {showStickers && <StickerPicker currentUserId={user.id} onPick={(sticker) => void sendSticker(sticker)} onPickImage={(stickerId) => void sendImageSticker(stickerId)} onClose={() => setShowStickers(false)} />}
            </div>
            <button className="send" aria-label="Отправить" disabled={sending}><SendIcon /></button>
          </form>
        </section>

        <aside className={`member-panel ${mobilePanel === "members" ? "mobile-open" : ""}`}>
          <div className="member-title">УЧАСТНИКИ — {liveMembers.length}</div>
          {liveMembers.map((member) => <button className="member" key={member.key}><Avatar name={member.name} avatarPath={member.avatarPath} avatarFrame={member.avatarFrame} className={`avatar avatar-${member.name.charCodeAt(0) % 4}`}><i /></Avatar><span><b>{member.name}</b><small>{member.status}</small></span></button>)}
        </aside>
        {mobilePanel && <button className="scrim" onClick={() => setMobilePanel(null)} aria-label="Закрыть панель" />}
        {voice.room && (
          <VoiceCallOverlay
            title={`♫ ${voice.room}`}
            subtitle={voice.status === "joining" ? "Подключение…" : `${voice.participantCount} в эфире`}
            error={voice.error}
            selfName={user.displayName}
            selfAvatarPath={user.avatarPath}
            selfAvatarFrame={user.avatarFrame}
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
      {callToastAndDock}
      {createServerModal}
    </>
  );
}
