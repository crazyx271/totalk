"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ToTalkUser } from "./page";
import StickerPicker from "./StickerPicker";
import ProfileModal from "./ProfileModal";
import UserProfileCard from "./UserProfileCard";
import SettingsModal from "./SettingsModal";
import Avatar from "./Avatar";
import type { Sticker } from "./stickers";
import type { CommunityServer, DirectCall, Friend } from "./callTypes";
import { CheckIcon, ChevronLeftIcon, DownloadIcon, LogOutIcon, MenuIcon, MessageIcon, PaperclipIcon, PhoneIcon, PlusIcon, SearchIcon, SendIcon, SettingsIcon, SmileIcon, UsersIcon, XIcon } from "./Icons";
import { useIsDesktopApp } from "./useIsDesktopApp";
import { PhoneOffIcon } from "./CallIcons";

type DirectMessage = {
  id: number;
  senderId: number;
  recipientId: number;
  author: string;
  username: string;
  avatarPath: string | null;
  avatarFrame: string | null;
  text: string;
  kind: string;
  fileName: string | null;
  fileMime: string | null;
  fileSize: number | null;
  createdAt: string;
};

type CallHistoryEntry = {
  id: number;
  incoming: boolean;
  status: "ended" | "declined";
  missed: boolean;
  durationMs: number;
  createdAt: number;
};

type SocialData = {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  results: Friend[];
};

function formatCallDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function describeCall(call: CallHistoryEntry) {
  if (call.status === "declined") return call.incoming ? "Вы отклонили звонок" : "Звонок отклонён";
  if (call.missed) return call.incoming ? "Пропущенный звонок" : "Нет ответа";
  return `${call.incoming ? "Входящий" : "Исходящий"} звонок · ${formatCallDuration(call.durationMs)}`;
}

const emptySocial: SocialData = { friends: [], incoming: [], outgoing: [], results: [] };

export default function HomeHub({
  user,
  servers,
  onOpenServer,
  onCreateServer,
  onLogout,
  onUpdateUser,
  activeCall,
  onStartCall,
  focusFriendId,
  onFocusHandled,
  onConversationChange,
  callPanel,
}: {
  user: ToTalkUser;
  servers: CommunityServer[];
  onOpenServer: (server: CommunityServer) => void;
  onCreateServer: () => void;
  onLogout: () => Promise<void>;
  onUpdateUser: (user: ToTalkUser) => void;
  activeCall: DirectCall | null;
  onStartCall: (friend: Friend) => Promise<string | null>;
  focusFriendId: number | null;
  onFocusHandled: () => void;
  onConversationChange: (friendId: number | null) => void;
  callPanel?: ReactNode;
}) {
  const [social, setSocial] = useState<SocialData>(emptySocial);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const isDesktop = useIsDesktopApp();
  const [viewedProfile, setViewedProfile] = useState<Friend | null>(null);
  const [section, setSection] = useState<"friends" | "pending" | "add">("friends");
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [search, setSearch] = useState("");
  const [searched, setSearched] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const [notice, setNotice] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const time = useMemo(() => new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }), []);

  useEffect(() => onConversationChange(selectedFriend?.id ?? null), [selectedFriend?.id, onConversationChange]);

  const timeline = useMemo(() => {
    const messageItems = messages.map((message) => ({
      type: "message" as const,
      epoch: new Date(`${message.createdAt}Z`).getTime(),
      message,
    }));
    const callItems = callHistory.map((call) => ({
      type: "call" as const,
      epoch: call.createdAt,
      call,
    }));
    return [...messageItems, ...callItems].sort((a, b) => a.epoch - b.epoch);
  }, [messages, callHistory]);

  // Open a conversation scrolled to the newest message, and stay pinned to
  // the bottom as new ones arrive — not stuck at the top of the history.
  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [selectedFriend, timeline.length]);

  const loadSocial = useCallback(async (query = "") => {
    const trimmed = query.trim();
    const params = trimmed.length >= 2 ? `?q=${encodeURIComponent(trimmed)}` : "";
    const response = await fetch(`/api/friends${params}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as SocialData;
    // The periodic background refresh below calls this with no query just
    // to keep friends/incoming/outgoing fresh — it shouldn't blow away
    // whatever search results are currently on screen with an empty list.
    setSocial((current) => (trimmed.length >= 2 ? data : { ...data, results: current.results }));
    setSelectedFriend((current) =>
      current ? data.friends.find((friend) => friend.id === current.id) ?? null : current,
    );
  }, []);

  const searchFriends = useCallback(async (query: string) => {
    setSelectedFriend(null);
    setSection("add");
    setSearched(query.trim().length >= 2);
    await loadSocial(query);
  }, [loadSocial]);

  const loadMessages = useCallback(async () => {
    if (!selectedFriend) {
      setMessages([]);
      return;
    }
    const response = await fetch(`/api/direct-messages?friend=${selectedFriend.id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { messages: DirectMessage[] };
    setMessages(data.messages);
  }, [selectedFriend]);

  const loadCallHistory = useCallback(async () => {
    if (!selectedFriend) {
      setCallHistory([]);
      return;
    }
    const response = await fetch(`/api/calls?friend=${selectedFriend.id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { history: CallHistoryEntry[] };
    setCallHistory(data.history);
  }, [selectedFriend]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadSocial(), 0);
    const timer = window.setInterval(() => void loadSocial(), 5000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadSocial]);

  useEffect(() => {
    const load = () => { void loadMessages(); void loadCallHistory(); };
    const initialLoad = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 2000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadMessages, loadCallHistory]);

  // A DM call was just accepted from outside this view (see ToTalkApp,
  // which owns call state so it survives navigating away) — jump to that
  // conversation once its friend data is available. Adjusted during render
  // (not an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastHandledFocusId, setLastHandledFocusId] = useState<number | null>(null);
  if (focusFriendId !== null && focusFriendId !== lastHandledFocusId) {
    const friend = social.friends.find((item) => item.id === focusFriendId);
    if (friend) {
      setLastHandledFocusId(focusFriendId);
      setSelectedFriend(friend);
      onFocusHandled();
    }
  }

  async function socialAction(action: string, friend: Friend) {
    setNotice("");
    const response = await fetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        userId: friend.id,
        requestId: friend.requestId,
      }),
    });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? (action === "request" ? "Заявка отправлена" : "Готово") : data.error ?? "Не удалось выполнить действие");
    await loadSocial(search);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!selectedFriend || !text) return;
    setDraft("");
    const response = await fetch("/api/direct-messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ friendId: selectedFriend.id, text }),
    });
    if (!response.ok) setDraft(text);
    await loadMessages();
  }

  async function sendSticker(sticker: Sticker) {
    if (!selectedFriend) return;
    setShowStickers(false);
    await fetch("/api/direct-messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ friendId: selectedFriend.id, text: sticker, kind: "sticker" }),
    });
    await loadMessages();
  }

  async function sendFile(file: File) {
    if (!selectedFriend || uploadingFile) return;
    setUploadingFile(true);
    setNotice("");
    const form = new FormData();
    form.append("scope", "dm");
    form.append("friendId", String(selectedFriend.id));
    form.append("file", file);
    try {
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось отправить файл");
      await loadMessages();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось отправить файл");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function startCall(friend: Friend) {
    const error = await onStartCall(friend);
    if (error) setNotice(error);
  }

  const renderPerson = (friend: Friend, actions?: ReactNode) => (
    <div className="friend-row" key={friend.id}>
      <div className="friend-main">
        <button type="button" className="friend-avatar-btn" onClick={() => setViewedProfile(friend)} aria-label={`Профиль ${friend.displayName}`}>
          <Avatar name={friend.displayName} avatarPath={friend.avatarPath} avatarFrame={friend.avatarFrame} className="friend-avatar">{friend.isOnline && <i />}</Avatar>
        </button>
        <button type="button" className="friend-name-btn" onClick={() => setSelectedFriend(friend)}>
          <b>{friend.displayName}</b><small>@{friend.username}</small>
        </button>
      </div>
      <div className="friend-actions">{actions}</div>
    </div>
  );

  return (
    <main className="app-shell home-shell">
      <nav className="server-rail" aria-label="Навигация">
        <button className="brand-mark active" aria-label="Главная">T</button>
        <span className="rail-divider" />
        {servers.map((server) => <button key={server.id} className="server-icon" onClick={() => onOpenServer(server)} aria-label={`Открыть группу ${server.name}`} title={server.name}>{server.name.trim().charAt(0).toUpperCase()}</button>)}
        <button className="server-icon add" onClick={onCreateServer} aria-label="Создать группу" title="Создать группу"><PlusIcon /></button>
      </nav>

      <aside className={`home-sidebar ${mobileNavOpen ? "mobile-open" : ""}`}>
        <form className="home-search" onSubmit={(event) => { event.preventDefault(); void searchFriends(search); }}>
          <SearchIcon />
          <input
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              if (value.trim().length < 2) setSearched(false);
            }}
            placeholder="Найти диалог"
            aria-label="Найти диалог по имени или логину"
          />
        </form>
        <button className={`home-nav ${!selectedFriend ? "active" : ""}`} onClick={() => { setSelectedFriend(null); setMobileNavOpen(false); }}><UsersIcon /><span>Друзья</span></button>
        <div className="home-side-title"><span>ЛИЧНЫЕ СООБЩЕНИЯ</span><button onClick={() => { setSelectedFriend(null); setSection("add"); setMobileNavOpen(false); }} aria-label="Добавить друга"><PlusIcon /></button></div>
        <div className="dm-list">
          {social.friends.map((friend) => (
            <div className={`dm-person ${selectedFriend?.id === friend.id ? "active" : ""}`} key={friend.id}>
              <button type="button" className="friend-avatar-btn" onClick={() => setViewedProfile(friend)} aria-label={`Профиль ${friend.displayName}`}>
                <Avatar name={friend.displayName} avatarPath={friend.avatarPath} avatarFrame={friend.avatarFrame} className="friend-avatar small">{friend.isOnline && <i />}</Avatar>
              </button>
              <button type="button" className="dm-person-name" onClick={() => { setSelectedFriend(friend); setMobileNavOpen(false); }}>
                <b>{friend.displayName}</b><small>@{friend.username}</small>
              </button>
            </div>
          ))}
          {social.friends.length === 0 && <p className="empty-side">Здесь появятся ваши друзья</p>}
        </div>
        <div className="home-user-bar">
          <button className="user-bar-identity" onClick={() => setShowProfile(true)} aria-label="Открыть профиль">
            <Avatar name={user.displayName} avatarPath={user.avatarPath} avatarFrame={user.avatarFrame} className="avatar self"><i /></Avatar>
            <span><b>{user.displayName}</b><small>@{user.username}</small></span>
          </button>
          {!isDesktop && <a href="/downloads/ToTalk-Setup.exe" download aria-label="Скачать для Windows"><DownloadIcon /></a>}
          <button onClick={() => setShowSettings(true)} aria-label="Настройки"><SettingsIcon /></button>
          <button onClick={() => void onLogout()} aria-label="Выйти"><LogOutIcon /></button>
        </div>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </aside>
      {mobileNavOpen && <button className="scrim" onClick={() => setMobileNavOpen(false)} aria-label="Закрыть список" />}
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSaved={onUpdateUser} />}
      {viewedProfile && (
        <UserProfileCard
          user={viewedProfile}
          isFriend={social.friends.some((friend) => friend.id === viewedProfile.id)}
          onClose={() => setViewedProfile(null)}
          onMessage={() => { setSelectedFriend(viewedProfile); setViewedProfile(null); }}
          onCall={() => { void startCall(viewedProfile); setViewedProfile(null); }}
        />
      )}

      <section className="home-content">
        {selectedFriend ? (
          <>
            <header className="dm-header">
              <button type="button" className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Список диалогов"><MenuIcon /></button>
              <button className="dm-back" onClick={() => setSelectedFriend(null)} aria-label="Назад"><ChevronLeftIcon /></button>
              <button type="button" className="friend-avatar-btn" onClick={() => setViewedProfile(selectedFriend)} aria-label={`Профиль ${selectedFriend.displayName}`}>
                <Avatar name={selectedFriend.displayName} avatarPath={selectedFriend.avatarPath} avatarFrame={selectedFriend.avatarFrame} className="friend-avatar">{selectedFriend.isOnline && <i />}</Avatar>
              </button>
              <button type="button" className="dm-header-name" onClick={() => setViewedProfile(selectedFriend)}>
                <b>{selectedFriend.displayName}</b><small>{selectedFriend.isOnline ? "В сети" : `@${selectedFriend.username}`}</small>
              </button>
              <button className="call-button" onClick={() => void startCall(selectedFriend)} disabled={Boolean(activeCall)}><PhoneIcon /><span>Позвонить</span></button>
            </header>
            {callPanel}
            <div className="dm-messages" ref={messagesRef}>
              {timeline.length === 0 && <div className="dm-intro"><Avatar name={selectedFriend.displayName} avatarPath={selectedFriend.avatarPath} avatarFrame={selectedFriend.avatarFrame} className="friend-avatar large" /><h2>{selectedFriend.displayName}</h2><p>Это начало вашей личной переписки с @{selectedFriend.username}.</p></div>}
              {timeline.map((item) => item.type === "message" ? (
                <article className={`dm-message ${item.message.senderId === user.id ? "mine" : ""} ${item.message.kind === "sticker" ? "sticker-message" : ""}`} key={`message-${item.message.id}`}>
                  <Avatar name={item.message.author} avatarPath={item.message.avatarPath} avatarFrame={item.message.avatarFrame} className="friend-avatar small" />
                  <div>
                    <b>{item.message.author}</b><time>{time.format(new Date(`${item.message.createdAt}Z`))}</time>
                    {item.message.kind === "sticker" ? <span className="sticker-bubble">{item.message.text}</span> : item.message.kind === "file" ? (
                      <a className="file-card" href={`/api/files/dm/${item.message.id}`} download>
                        <span><PaperclipIcon /></span><div><b>{item.message.fileName ?? item.message.text}</b><small>{item.message.fileSize ? `${(item.message.fileSize / 1024 / 1024).toFixed(1)} МБ` : "Файл"}</small></div><DownloadIcon />
                      </a>
                    ) : <p>{item.message.text}</p>}
                  </div>
                </article>
              ) : (
                <div className={`dm-call-event ${item.call.missed || item.call.status === "declined" ? "unsuccessful" : ""}`} key={`call-${item.call.id}`}>
                  {item.call.missed || item.call.status === "declined" ? <PhoneOffIcon /> : <PhoneIcon />}
                  <span>{describeCall(item.call)}</span>
                  <time>{time.format(new Date(item.call.createdAt))}</time>
                </div>
              ))}
            </div>
            {notice && <div className="dm-notice">{notice}</div>}
            <form className="dm-composer" onSubmit={sendMessage}>
              <input ref={fileInputRef} className="visually-hidden" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void sendFile(file); }} />
              <button type="button" className="attach-button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} aria-label="Отправить файл"><PaperclipIcon /></button>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Сообщение для @${selectedFriend.username}`} />
              <div className="sticker-anchor">
                <button type="button" aria-label="Стикеры" aria-pressed={showStickers} onClick={() => setShowStickers((open) => !open)}><SmileIcon /></button>
                {showStickers && <StickerPicker onPick={(sticker) => void sendSticker(sticker)} onClose={() => setShowStickers(false)} />}
              </div>
              <button disabled={!draft.trim()} aria-label="Отправить"><SendIcon /></button>
            </form>
          </>
        ) : (
          <>
            <header className="friends-header">
              <button type="button" className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Список диалогов"><MenuIcon /></button>
              <UsersIcon /><b>Друзья</b><span />
              <button className={section === "friends" ? "active" : ""} onClick={() => setSection("friends")}>Все</button>
              <button className={section === "pending" ? "active" : ""} onClick={() => setSection("pending")}>Заявки {social.incoming.length > 0 && <em>{social.incoming.length}</em>}</button>
              <button className="add-friend" onClick={() => setSection("add")}>Добавить друга</button>
            </header>
            <div className="welcome-body">
              <section className="welcome-hero">
                <div><small>ДОБРО ПОЖАЛОВАТЬ В TOTALK</small><h1>Привет, {user.displayName}!</h1><p>Общайтесь с друзьями, пишите лично и созванивайтесь в один клик.</p></div>
                <span className="welcome-orbit"><i>T</i></span>
              </section>

              {section === "friends" && <section className="friends-section"><h2>Все друзья — {social.friends.length}</h2>
                {social.friends.map((friend) => renderPerson(friend, <>
                  <button onClick={() => setSelectedFriend(friend)} aria-label="Написать"><MessageIcon /></button>
                  <button onClick={() => void startCall(friend)} aria-label="Позвонить"><PhoneIcon /></button>
                </>))}
                {social.friends.length === 0 && <div className="social-empty"><b>Список друзей пока пуст</b><p>Найдите пользователя по имени или логину и отправьте заявку.</p><button onClick={() => setSection("add")}>Найти друзей</button></div>}
              </section>}

              {section === "pending" && <section className="friends-section"><h2>Входящие заявки — {social.incoming.length}</h2>
                {social.incoming.map((friend) => renderPerson(friend, <>
                  <button className="accept" onClick={() => void socialAction("accept", friend)} aria-label="Принять"><CheckIcon /></button>
                  <button onClick={() => void socialAction("decline", friend)} aria-label="Отклонить"><XIcon /></button>
                </>))}
                {social.outgoing.length > 0 && <><h2>Отправленные — {social.outgoing.length}</h2>{social.outgoing.map((friend) => renderPerson(friend, <button onClick={() => void socialAction("decline", friend)}>Отменить</button>))}</>}
                {social.incoming.length + social.outgoing.length === 0 && <div className="social-empty"><b>Новых заявок нет</b><p>Когда кто-то добавит вас, заявка появится здесь.</p></div>}
              </section>}

              {section === "add" && <section className="friends-section add-section"><h2>Добавить друга</h2><p>Найдите человека по отображаемому имени или точному логину.</p>
                <form onSubmit={(event) => { event.preventDefault(); void searchFriends(search); }}>
                  <input value={search} onChange={(event) => { const value = event.target.value; setSearch(value); if (value.trim().length < 2) setSearched(false); }} minLength={2} placeholder="Введите имя или логин" />
                  <button><SearchIcon /><span>Найти</span></button>
                </form>
                {notice && <div className="social-notice">{notice}</div>}
                {social.results.map((friend) => renderPerson(friend, <button className="accept" onClick={() => void socialAction("request", friend)}>Добавить</button>))}
                {searched && social.results.length === 0 && (
                  <div className="social-empty"><b>Никого не нашли</b><p>Проверьте логин или имя — попробуйте другой запрос.</p></div>
                )}
              </section>}
            </div>
          </>
        )}
      </section>

    </main>
  );
}
