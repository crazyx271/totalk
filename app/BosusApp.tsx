"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Message = {
  id: number;
  userId?: number;
  author: string;
  username?: string;
  avatar: string;
  time: string;
  text: string;
  mine?: boolean;
};

const servers = [
  { id: "bosus", short: "B", name: "Bosus", subtitle: "Клуб создателей", tone: "brand", channels: ["welcome", "общий", "идеи", "музыка", "игры"] },
  { id: "club", short: "КЛ", name: "Клуб", subtitle: "Друзья и общение", tone: "violet", channels: ["общий", "новости", "фото", "мемы"] },
  { id: "games", short: "ИГ", name: "Игровая", subtitle: "Играем вместе", tone: "coral", channels: ["лобби", "поиск-группы", "клипы", "оффтоп"] },
  { id: "music", short: "МУ", name: "Музыка", subtitle: "Слушаем и делимся", tone: "blue", channels: ["чат", "новинки", "плейлисты", "концерты"] },
] as const;

const initialMessages: Message[] = [
  { id: 1, author: "Bosus Bot", avatar: "B", time: "сегодня, 18:04", text: "Добро пожаловать в Bosus! Это наше новое место для общения." },
  { id: 2, author: "Алёна", avatar: "А", time: "18:07", text: "Всем привет! Кто уже успел посмотреть новые каналы?" },
  { id: 3, author: "Макс", avatar: "М", time: "18:08", text: "Да! Интерфейс отлично смотрится и на телефоне 👌" },
  { id: 4, author: "Алёна", avatar: "А", time: "18:09", text: "Давайте вечером созвонимся в голосовом?" },
];

const members = [
  ["А", "Алёна", "В сети"], ["М", "Макс", "Играет"], ["Д", "Данил", "В сети"], ["Л", "Лера", "На телефоне"],
];

type BosusAppProps = {
  user: {
    id: number;
    displayName: string;
    username: string;
  };
  onLogout: () => Promise<void>;
};

export default function BosusApp({ user, onLogout }: BosusAppProps) {
  const [serverId, setServerId] = useState("bosus");
  const [channel, setChannel] = useState("общий");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState<"loading" | "online" | "error">("loading");
  const [sending, setSending] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"channels" | "members" | null>(null);
  const date = useMemo(() => new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }), []);
  const currentServer = servers.find((server) => server.id === serverId) ?? servers[0];

  const loadMessages = useCallback(async () => {
    try {
      const query = new URLSearchParams({ server: serverId, channel });
      const response = await fetch(`/api/messages?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("messages unavailable");
      const data = await response.json() as {
        messages: Array<{ id: number; userId: number; author: string; username: string; text: string; createdAt: string }>;
      };
      setMessages(data.messages.map((message) => ({
        id: message.id,
        userId: message.userId,
        author: message.author,
        username: message.username,
        avatar: message.author.trim().charAt(0).toUpperCase() || "?",
        time: new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }).format(new Date(`${message.createdAt}Z`)),
        text: message.text,
        mine: message.userId === user.id,
      })));
      setConnection("online");
    } catch {
      setConnection("error");
    }
  }, [channel, serverId, user.id]);

  useEffect(() => {
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 2000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  function switchServer(id: string) {
    const nextServer = servers.find((server) => server.id === id) ?? servers[0];
    setServerId(nextServer.id);
    setChannel(nextServer.channels[0]);
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
      mine: true,
    }]);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverId, channel, text }),
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

  return (
    <main className="app-shell">
      <nav className="server-rail" aria-label="Серверы">
        {servers.map((server, index) => (
          <div className="server-slot" key={server.id}>
            {index === 1 && <span className="rail-divider" />}
            <button
              onClick={() => switchServer(server.id)}
              className={`${server.tone === "brand" ? "brand-mark" : `server-icon ${server.tone}`} ${serverId === server.id ? "active" : ""}`}
              aria-label={`Сервер ${server.name}`}
              aria-pressed={serverId === server.id}
            >{server.short}</button>
          </div>
        ))}
        <button className="server-icon add" aria-label="Добавить сервер">+</button>
      </nav>

      <aside className={`channel-panel ${mobilePanel === "channels" ? "mobile-open" : ""}`}>
        <div className="workspace-title"><span><b>{currentServer.name}</b><small>{currentServer.subtitle}</small></span><span className={`connection ${connection}`}>{connection === "online" ? "● онлайн" : connection === "loading" ? "○ вход…" : "● нет связи"}</span></div>
        <div className="channel-scroll">
          <button className="event-card"><span>✦</span><div><b>Новое событие</b><small>Создать встречу</small></div></button>
          <div className="section-label"><span>ТЕКСТОВЫЕ КАНАЛЫ</span><button>+</button></div>
          {currentServer.channels.map((item) => <button key={item} onClick={() => { setChannel(item); setMobilePanel(null); }} className={`channel ${channel === item ? "selected" : ""}`}><span>#</span>{item}{item === "общий" && <em>3</em>}</button>)}
          <div className="section-label"><span>ГОЛОСОВЫЕ КАНАЛЫ</span><button>+</button></div>
          <button className="channel"><span>♫</span>Лобби</button>
          <button className="channel"><span>♫</span>Комната отдыха</button>
          <div className="voice-users"><span className="mini-avatar">M</span><div><b>Макс</b><small>В эфире</small></div></div>
        </div>
        <div className="user-bar"><span className="avatar self">{user.displayName.charAt(0).toUpperCase()}<i /></span><div><b>{user.displayName}</b><small>@{user.username}</small></div><button onClick={() => void onLogout()} aria-label="Выйти">↪</button></div>
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
            <article className={`message ${message.mine ? "mine" : ""}`} key={message.id}>
              <span className={`avatar avatar-${message.avatar.charCodeAt(0) % 4}`}>{message.avatar}</span>
              <div><div className="message-meta"><b>{message.author}</b><time>{message.time}</time></div><p>{message.text}</p></div>
            </article>
          ))}
        </div>
        <form className="composer" onSubmit={sendMessage}>
          <button type="button" aria-label="Добавить">+</button>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Написать #${channel}`} aria-label="Сообщение" />
          <button type="button" aria-label="Эмодзи">☺</button><button className="send" aria-label="Отправить" disabled={sending}>↑</button>
        </form>
      </section>

      <aside className={`member-panel ${mobilePanel === "members" ? "mobile-open" : ""}`}>
        <div className="member-title">В СЕТИ — 4</div>
        {members.map(([avatar, name, status]) => <button className="member" key={name}><span className={`avatar avatar-${avatar.charCodeAt(0) % 4}`}>{avatar}<i /></span><span><b>{name}</b><small>{status}</small></span></button>)}
        <div className="member-title">НЕ В СЕТИ — 2</div>
        <button className="member offline"><span className="avatar">C</span><span><b>Саша</b><small>Не в сети</small></span></button>
        <button className="member offline"><span className="avatar">K</span><span><b>Kirill</b><small>Не в сети</small></span></button>
      </aside>
      {mobilePanel && <button className="scrim" onClick={() => setMobilePanel(null)} aria-label="Закрыть панель" />}
    </main>
  );
}
