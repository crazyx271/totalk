"use client";

import { FormEvent, useEffect, useState } from "react";
import ToTalkApp from "./ToTalkApp";
import { DownloadIcon, MessageIcon, UsersIcon, XIcon } from "./Icons";
import { MonitorIcon, VideoIcon } from "./CallIcons";

export type ToTalkUser = {
  id: number;
  username: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  bannerColor: string | null;
  createdAt: string;
};

const FEATURES = [
  { icon: <VideoIcon />, title: "Голос и видео", text: "Звоните друзьям в один клик — без ожидания и лишних приглашений." },
  { icon: <MonitorIcon />, title: "Демонстрация экрана", text: "Показывайте рабочий стол или игру прямо во время разговора." },
  { icon: <MessageIcon />, title: "Чат и стикеры", text: "Общайтесь в группе или лично, добавляйте стикеры для настроения." },
  { icon: <UsersIcon />, title: "Друзья и ЛС", text: "Находите людей по логину, добавляйте в друзья и пишите напрямую." },
];

export default function Home() {
  const [user, setUser] = useState<ToTalkUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showAuth, setShowAuth] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  if (!user) {
    return (
      <main className="landing">
        <header className="landing-nav">
          <div className="landing-brand"><span>T</span><b>ToTalk</b></div>
          <nav>
            <a href="#features">Возможности</a>
            <a href="#download">Скачать</a>
          </nav>
          <div className="landing-nav-actions">
            <button onClick={() => openAuth("login")}>Войти</button>
            <button className="primary" onClick={() => openAuth("register")}>Регистрация</button>
          </div>
        </header>

        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1>Общение без границ</h1>
            <p>Голос, видео, текст, демонстрация экрана и стикеры — всё в одном месте, без границ и подписок.</p>
            <div className="landing-hero-actions">
              <button className="primary" onClick={() => openAuth("register")}>Начать общение</button>
              <a href="/downloads/ToTalk-Setup.exe" download><DownloadIcon />Скачать для Windows</a>
            </div>
          </div>
          <div className="landing-hero-art" aria-hidden="true">
            <span className="hero-orb hero-orb-1" />
            <span className="hero-orb hero-orb-2" />
            <div className="hero-card hero-card-chat">
              <div className="hero-card-dots"><i /><i /><i /></div>
              <span className="hero-bubble w1" />
              <span className="hero-bubble w2 mine" />
              <span className="hero-bubble w3" />
            </div>
            <div className="hero-card hero-card-call">
              <span className="hero-avatar">T</span>
              <div className="hero-call-actions"><i /><i /><i className="danger" /></div>
            </div>
          </div>
        </section>

        <section className="landing-features" id="features">
          <h2>Всё для живого общения</h2>
          <div className="landing-feature-grid">
            {FEATURES.map((feature) => (
              <div className="landing-feature-card" key={feature.title}>
                <span className="landing-feature-icon">{feature.icon}</span>
                <b>{feature.title}</b>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-platforms" id="download">
          <h2>Заходите откуда угодно</h2>
          <p>Один аккаунт для браузера и приложения на Windows — переписка и звонки синхронизируются мгновенно.</p>
          <div className="landing-platform-row">
            <div className="landing-platform-card"><DownloadIcon /><b>Windows</b><small>Приложение с автообновлением</small></div>
            <div className="landing-platform-card"><MonitorIcon /><b>Браузер</b><small>Без установки, сразу в деле</small></div>
          </div>
          <a className="landing-download" href="/downloads/ToTalk-Setup.exe" download><DownloadIcon />Скачать для Windows</a>
        </section>

        <footer className="landing-footer">
          <div className="landing-brand"><span>T</span><b>ToTalk</b></div>
          <span>© {new Date().getFullYear()} ToTalk. Общение без границ.</span>
        </footer>

        {showAuth && (
          <div className="modal-scrim" onClick={() => setShowAuth(false)}>
            <section className="modal-card auth-card" onClick={(event) => event.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowAuth(false)} aria-label="Закрыть"><XIcon /></button>
              <div className="auth-brand"><span>T</span><div><b>ToTalk</b><small>Общение без границ</small></div></div>
              <h1>{mode === "login" ? "С возвращением" : "Создайте аккаунт"}</h1>
              <p>{mode === "login" ? "Войдите, чтобы продолжить общение." : "Один аккаунт для браузера, ПК и телефона."}</p>
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

  return <ToTalkApp user={user} onLogout={logout} onUpdateUser={setUser} />;
}
