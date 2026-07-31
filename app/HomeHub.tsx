"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ToTalkUser } from "./page";
import VoiceCallOverlay from "./VoiceCallOverlay";
import StickerPicker from "./StickerPicker";
import ProfileModal from "./ProfileModal";
import Avatar from "./Avatar";
import { useVoiceChat } from "./useVoiceChat";
import { playConnectTone, playEndTone, startRingtone, stopRingtone } from "./callSounds";
import type { Sticker } from "./stickers";
import { CheckIcon, ChevronLeftIcon, LogOutIcon, MessageIcon, PhoneIcon, PlusIcon, SearchIcon, SendIcon, SmileIcon, UsersIcon, XIcon } from "./Icons";
import { PhoneOffIcon } from "./CallIcons";

type Friend = {
  id: number;
  username: string;
  displayName: string;
  avatarPath: string | null;
  requestId?: number;
};

type DirectMessage = {
  id: number;
  senderId: number;
  recipientId: number;
  author: string;
  username: string;
  avatarPath: string | null;
  text: string;
  kind: string;
  createdAt: string;
};

type DirectCall = {
  id: number;
  callerId: number;
  calleeId: number;
  room: string;
  status: "ringing" | "accepted";
  incoming: boolean;
  person: Friend;
};

type SocialData = {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  results: Friend[];
};

const emptySocial: SocialData = { friends: [], incoming: [], outgoing: [], results: [] };

export default function HomeHub({
  user,
  onOpenServer,
  onLogout,
  onUpdateUser,
}: {
  user: ToTalkUser;
  onOpenServer: () => void;
  onLogout: () => Promise<void>;
  onUpdateUser: (user: ToTalkUser) => void;
}) {
  const [social, setSocial] = useState<SocialData>(emptySocial);
  const [showProfile, setShowProfile] = useState(false);
  const [section, setSection] = useState<"friends" | "pending" | "add">("friends");
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [search, setSearch] = useState("");
  const [searched, setSearched] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const [notice, setNotice] = useState("");
  const [incomingCall, setIncomingCall] = useState<DirectCall | null>(null);
  const [activeCall, setActiveCall] = useState<DirectCall | null>(null);
  const voice = useVoiceChat("dm");
  const leaveVoice = voice.leave;
  const voiceRoom = voice.room;
  const time = useMemo(() => new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }), []);

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

  const loadCalls = useCallback(async () => {
    const response = await fetch("/api/calls", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { calls: DirectCall[] };
    setIncomingCall(data.calls.find((call) => call.incoming && call.status === "ringing") ?? null);
    setActiveCall((current) => {
      if (!current) return null;
      const updated = data.calls.find((call) => call.id === current.id) ?? null;
      if (!updated) {
        if (voiceRoom) void leaveVoice();
        playEndTone();
      }
      return updated;
    });
  }, [leaveVoice, voiceRoom]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadSocial(), 0);
    const timer = window.setInterval(() => void loadSocial(), 5000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadSocial]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMessages(), 0);
    const timer = window.setInterval(() => void loadMessages(), 2000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadMessages]);

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
    if (activeCall && voice.participantCount > 1) {
      if (!connectedToneRef.current) {
        connectedToneRef.current = true;
        playConnectTone();
      }
    } else if (!activeCall) {
      connectedToneRef.current = false;
    }
  }, [activeCall, voice.participantCount]);

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

  async function startCall(friend: Friend) {
    const response = await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start", friendId: friend.id }),
    });
    const data = await response.json() as { call?: DirectCall; error?: string };
    if (!response.ok || !data.call) {
      setNotice(data.error ?? "Не удалось начать звонок");
      return;
    }
    setActiveCall({ ...data.call, incoming: false, person: friend });
    await voice.join(data.call.room);
  }

  async function acceptCall(call: DirectCall) {
    const response = await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "accept", callId: call.id }),
    });
    if (!response.ok) return;
    setIncomingCall(null);
    setActiveCall({ ...call, status: "accepted" });
    setSelectedFriend(call.person);
    await voice.join(call.room);
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
    await voice.leave();
  }

  const renderPerson = (friend: Friend, actions?: ReactNode) => (
    <div className="friend-row" key={friend.id}>
      <button className="friend-main" onClick={() => setSelectedFriend(friend)}>
        <Avatar name={friend.displayName} avatarPath={friend.avatarPath} className="friend-avatar" />
        <span><b>{friend.displayName}</b><small>@{friend.username}</small></span>
      </button>
      <div className="friend-actions">{actions}</div>
    </div>
  );

  return (
    <main className="app-shell home-shell">
      <nav className="server-rail" aria-label="Навигация">
        <button className="brand-mark active" aria-label="Главная">T</button>
        <span className="rail-divider" />
        <button className="brand-mark" onClick={onOpenServer} aria-label="Открыть ToTalk">T</button>
      </nav>

      <aside className="home-sidebar">
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
        <button className={`home-nav ${!selectedFriend ? "active" : ""}`} onClick={() => setSelectedFriend(null)}><UsersIcon /><span>Друзья</span></button>
        <div className="home-side-title"><span>ЛИЧНЫЕ СООБЩЕНИЯ</span><button onClick={() => { setSelectedFriend(null); setSection("add"); }} aria-label="Добавить друга"><PlusIcon /></button></div>
        <div className="dm-list">
          {social.friends.map((friend) => (
            <button className={`dm-person ${selectedFriend?.id === friend.id ? "active" : ""}`} key={friend.id} onClick={() => setSelectedFriend(friend)}>
              <Avatar name={friend.displayName} avatarPath={friend.avatarPath} className="friend-avatar small" />
              <span><b>{friend.displayName}</b><small>@{friend.username}</small></span>
            </button>
          ))}
          {social.friends.length === 0 && <p className="empty-side">Здесь появятся ваши друзья</p>}
        </div>
        <div className="home-user-bar">
          <button className="user-bar-identity" onClick={() => setShowProfile(true)} aria-label="Открыть профиль">
            <Avatar name={user.displayName} avatarPath={user.avatarPath} className="avatar self"><i /></Avatar>
            <span><b>{user.displayName}</b><small>@{user.username}</small></span>
          </button>
          <button onClick={() => void onLogout()} aria-label="Выйти"><LogOutIcon /></button>
        </div>
      </aside>
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSaved={onUpdateUser} />}

      <section className="home-content">
        {selectedFriend ? (
          <>
            <header className="dm-header">
              <button className="dm-back" onClick={() => setSelectedFriend(null)} aria-label="Назад"><ChevronLeftIcon /></button>
              <Avatar name={selectedFriend.displayName} avatarPath={selectedFriend.avatarPath} className="friend-avatar" />
              <span><b>{selectedFriend.displayName}</b><small>@{selectedFriend.username}</small></span>
              <button className="call-button" onClick={() => void startCall(selectedFriend)} disabled={Boolean(activeCall)}><PhoneIcon /><span>Позвонить</span></button>
            </header>
            <div className="dm-messages">
              {messages.length === 0 && <div className="dm-intro"><Avatar name={selectedFriend.displayName} avatarPath={selectedFriend.avatarPath} className="friend-avatar large" /><h2>{selectedFriend.displayName}</h2><p>Это начало вашей личной переписки с @{selectedFriend.username}.</p></div>}
              {messages.map((message) => (
                <article className={`dm-message ${message.senderId === user.id ? "mine" : ""} ${message.kind === "sticker" ? "sticker-message" : ""}`} key={message.id}>
                  <Avatar name={message.author} avatarPath={message.avatarPath} className="friend-avatar small" />
                  <div>
                    <b>{message.author}</b><time>{time.format(new Date(`${message.createdAt}Z`))}</time>
                    {message.kind === "sticker" ? <span className="sticker-bubble">{message.text}</span> : <p>{message.text}</p>}
                  </div>
                </article>
              ))}
            </div>
            <form className="dm-composer" onSubmit={sendMessage}>
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
            <header className="friends-header"><UsersIcon /><b>Друзья</b><span />
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

      {incomingCall && <div className="call-toast">
        <Avatar name={incomingCall.person.displayName} avatarPath={incomingCall.person.avatarPath} className="friend-avatar" />
        <div><small>ВХОДЯЩИЙ ЗВОНОК</small><b>{incomingCall.person.displayName}</b></div>
        <button className="accept-call" onClick={() => void acceptCall(incomingCall)} aria-label="Принять звонок"><PhoneIcon /></button>
        <button className="decline-call" onClick={() => void finishCall(incomingCall, "decline")} aria-label="Отклонить звонок"><PhoneOffIcon /></button>
      </div>}
      {activeCall && (
        <VoiceCallOverlay
          title={activeCall.person.displayName}
          subtitle={activeCall.status === "ringing" ? "Звоним…" : voice.participantCount > 1 ? "Голосовая связь установлена" : "Подключение…"}
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
          onLeave={() => void finishCall(activeCall, "end")}
        />
      )}
    </main>
  );
}
