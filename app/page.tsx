"use client";

import { FormEvent, useEffect, useState } from "react";
import ToTalkApp from "./ToTalkApp";

export type ToTalkUser = {
  id: number;
  username: string;
  displayName: string;
};

export default function Home() {
  const [user, setUser] = useState<ToTalkUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
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
      <main className="auth-shell">
        <section className="auth-card">
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
      </main>
    );
  }

  return <ToTalkApp user={user} onLogout={logout} onUpdateUser={setUser} />;
}
