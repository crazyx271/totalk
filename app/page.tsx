"use client";

import { FormEvent, useEffect, useState } from "react";
import ToTalkApp from "./ToTalkApp";
import { DownloadIcon, MessageIcon, UsersIcon, XIcon } from "./Icons";
import { MonitorIcon, VideoIcon } from "./CallIcons";
import { useIsDesktopApp } from "./useIsDesktopApp";

export type ToTalkUser = {
  id: number;
  username: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  bannerColor: string | null;
  bannerPath: string | null;
  avatarFrame: string | null;
  avatarPosition: string | null;
  bannerPosition: string | null;
  isUltra: boolean;
  createdAt: string;
};

const FEATURES = [
  { icon: <VideoIcon />, title: "Голос и видео", text: "Личные звонки и голосовые комнаты — без лишних приглашений и ограничений." },
  { icon: <MonitorIcon />, title: "Демонстрация экрана", text: "Показывайте рабочий стол, презентацию или игру прямо во время разговора." },
  { icon: <MessageIcon />, title: "Чаты и файлы", text: "Пишите лично и в каналах, отправляйте реакции, изображения и документы." },
  { icon: <UsersIcon />, title: "Друзья и сообщества", text: "Собирайте своё пространство и оставайтесь на связи с важными людьми." },
];

export default function Home() {
  const [user, setUser] = useState<ToTalkUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showAuth, setShowAuth] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isDesktop = useIsDesktopApp();

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json() as { user: ToTalkUser };
          setUser(data.user);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function openAuth(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setShowAuth(true);
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      username: String(form.get("username") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
      password: String(form.get("password") ?? ""),
    };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await response.text();
      let data: { user?: ToTalkUser; error?: string };
      try {
        data = JSON.parse(raw) as { user?: ToTalkUser; error?: string };
      } catch {
        throw new Error("Сервер авторизации временно недоступен");
      }
      if (!response.ok || !data.user) throw new Error(data.error ?? "Не удалось войти");
      setUser(data.user);
      setShowAuth(false);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Не удалось войти");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMode("login");
  }

  if (loading) {
    return <main className="auth-shell"><div className="auth-loading"><span>T</span><p>ToTalk запускается…</p></div></main>;
  }

  if (user) return <ToTalkApp user={user} onLogout={logout} onUpdateUser={setUser} />;

  return (
    <main className="landing public-site">
      <header className="public-header">
        <a className="public-brand" href="#top" aria-label="ToTalk — на главную"><span>T</span><b>ToTalk</b></a>
        <nav aria-label="Навигация по странице">
          <a href="#features">Возможности</a>
          {!isDesktop && <a href="/download">Приложения</a>}
        </nav>
        <div className="public-header-actions">
          <button className="public-ghost" onClick={() => openAuth("login")}>Войти</button>
          <button className="public-primary small" onClick={() => openAuth("register")}>Создать аккаунт</button>
        </div>
      </header>

      <section className="public-hero" id="top">
        <div className="public-hero-copy">
          <span className="public-eyebrow"><i /> ToTalk 0.2 уже доступен</span>
          <h1>Общение, которое всегда рядом.</h1>
          <p>Сообщения, друзья, сообщества, голосовые и видеозвонки — в одном спокойном пространстве на любом устройстве.</p>
          <div className="public-hero-actions">
            <button className="public-primary" onClick={() => openAuth("register")}>Открыть в браузере</button>
            {!isDesktop && <a className="public-secondary" href="/download"><DownloadIcon />Скачать приложение</a>}
          </div>
          <div className="public-platform-list" aria-label="Поддерживаемые платформы">
            <span>Windows</span><span>macOS</span><span>Linux</span><span>Android</span><span>iPhone</span>
          </div>
        </div>

        <div className="product-preview" aria-label="Предпросмотр интерфейса ToTalk">
          <div className="preview-window-bar"><i /><i /><i /><span>ToTalk</span></div>
          <div className="preview-app">
            <aside className="preview-rail"><b>T</b><i /><i /><i /></aside>
            <aside className="preview-sidebar">
              <small>ЛИЧНЫЕ СООБЩЕНИЯ</small>
              <div className="preview-person active"><span>А</span><b>Алекс</b></div>
              <div className="preview-person"><span>М</span><b>Маша</b></div>
              <div className="preview-person"><span>К</span><b>Команда</b></div>
            </aside>
            <div className="preview-chat">
              <header><span>А</span><div><b>Алекс</b><small>в сети</small></div></header>
              <div className="preview-messages">
                <p>Уже заходишь в звонок?</p>
                <p className="mine">Да, я на связи 👋</p>
                <div className="preview-call"><VideoIcon /><span><b>Видеозвонок</b><small>Нажмите, чтобы присоединиться</small></span></div>
              </div>
              <div className="preview-composer">Написать сообщение… <span>＋</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-proof" aria-label="Преимущества ToTalk">
        <div><b>Один аккаунт</b><span>История синхронизируется между устройствами</span></div>
        <div><b>Живое общение</b><span>Голос, видео и демонстрация экрана</span></div>
        <div><b>Без подписки</b><span>Основные функции доступны бесплатно</span></div>
      </section>

      <section className="public-features" id="features">
        <div className="public-section-heading"><span>ВОЗМОЖНОСТИ</span><h2>Всё нужное. Ничего лишнего.</h2><p>Знакомый ритм общения в более чистом и собранном интерфейсе.</p></div>
        <div className="public-feature-grid">
          {FEATURES.map((feature, index) => (
            <article className="public-feature-card" key={feature.title}>
              <span className="public-feature-number">0{index + 1}</span>
              <span className="public-feature-icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      {!isDesktop && (
        <section className="public-download-banner">
          <div><span>TOTALK НА ВСЕХ УСТРОЙСТВАХ</span><h2>Продолжайте разговор где угодно.</h2><p>Выберите свою систему на отдельной странице загрузки. Для Linux и телефонов доступна устанавливаемая веб-версия.</p></div>
          <a className="public-primary" href="/download"><DownloadIcon />Перейти к загрузкам</a>
        </section>
      )}

      <footer className="public-footer">
        <a className="public-brand" href="#top"><span>T</span><b>ToTalk</b></a>
        <p>© {new Date().getFullYear()} ToTalk. Общение без границ.</p>
        {!isDesktop && <a href="/download">Все приложения</a>}
      </footer>

      {showAuth && (
        <div className="modal-scrim" onClick={() => setShowAuth(false)}>
          <section className="modal-card auth-card" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuth(false)} aria-label="Закрыть"><XIcon /></button>
            <div className="auth-brand"><span>T</span><div><b>ToTalk</b><small>Общение без границ</small></div></div>
            <h1>{mode === "login" ? "С возвращением" : "Создайте аккаунт"}</h1>
            <p>{mode === "login" ? "Войдите, чтобы продолжить общение." : "Один аккаунт для браузера, компьютера и телефона."}</p>
            <form onSubmit={authenticate}>
              {mode === "register" && <label>Отображаемое имя<input name="displayName" minLength={2} maxLength={32} required autoComplete="name" placeholder="Как вас называть?" /></label>}
              <label>Логин<input name="username" minLength={3} maxLength={24} required autoComplete="username" placeholder="например, totalk_user" /></label>
              <label>Пароль<input name="password" type="password" minLength={8} maxLength={128} required autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Минимум 8 символов" /></label>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="auth-submit" disabled={submitting}>{submitting ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}</button>
            </form>
            <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
