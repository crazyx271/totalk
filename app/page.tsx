"use client";

import { FormEvent, useMemo, useState } from "react";

type Message = {
  id: number;
  author: string;
  avatar: string;
  time: string;
  text: string;
  mine?: boolean;
};

const channels = ["welcome", "общий", "идеи", "музыка", "игры"];

const initialMessages: Message[] = [
  { id: 1, author: "Bosus Bot", avatar: "B", time: "сегодня, 18:04", text: "Добро пожаловать в Bosus! Это наше новое место для общения." },
  { id: 2, author: "Алёна", avatar: "А", time: "18:07", text: "Всем привет! Кто уже успел посмотреть новые каналы?" },
  { id: 3, author: "Макс", avatar: "М", time: "18:08", text: "Да! Интерфейс отлично смотрится и на телефоне 👌" },
  { id: 4, author: "Алёна", avatar: "А", time: "18:09", text: "Давайте вечером созвонимся в голосовом?" },
];

const members = [
  ["А", "Алёна", "В сети"], ["М", "Макс", "Играет"], ["Д", "Данил", "В сети"], ["Л", "Лера", "На телефоне"],
];

export default function Home() {
  const [channel, setChannel] = useState("общий");
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"channels" | "members" | null>(null);
  const date = useMemo(() => new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }), []);

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: Date.now(), author: "Вы", avatar: "В", time: date.format(new Date()), text, mine: true }]);
    setDraft("");
  }

  return (
    <main className="app-shell">
      <nav className="server-rail" aria-label="Серверы">
        <button className="brand-mark active" aria-label="Bosus">B</button>
        <span className="rail-divider" />
        <button className="server-icon violet">КЛ</button>
        <button className="server-icon coral">ИГ</button>
        <button className="server-icon blue">МУ</button>
        <button className="server-icon add" aria-label="Добавить сервер">+</button>
      </nav>

      <aside className={`channel-panel ${mobilePanel === "channels" ? "mobile-open" : ""}`}>
        <div className="workspace-title"><span><b>Bosus</b><small>Клуб создателей</small></span><button>⌤</button></div>
        <div className="channel-scroll">
          <button className="event-card"><span>✦</span><div><b>Новое событие</b><small>Создать встречу</small></div></button>
          <div className="section-label"><span>ТЕКСТОВЫЕ КАНАЛЫ</span><button>+</button></div>
          {channels.map((item) => <button key={item} onClick={() => { setChannel(item); setMobilePanel(null); }} className={`channel ${channel === item ? "selected" : ""}`}><span>#</span>{item}{item === "общий" && <em>3</em>}</button>)}
          <div className="section-label"><span>ГОЛОСОВЫЕ КАНАЛЫ</span><button>+</button></div>
          <button className="channel"><span>♫</span>Лобби</button>
          <button className="channel"><span>♫</span>Комната отдыха</button>
          <div className="voice-users"><span className="mini-avatar">M</span><div><b>Макс</b><small>В эфире</small></div></div>
        </div>
        <div className="user-bar"><span className="avatar self">В<i /></span><div><b>bosus_user</b><small>#0428</small></div><button>♪</button><button>⚙</button></div>
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
          <button type="button" aria-label="Эмодзи">☺</button><button className="send" aria-label="Отправить">↑</button>
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
