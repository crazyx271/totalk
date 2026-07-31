"use client";

import { FormEvent, useState } from "react";
import type { ToTalkUser } from "./page";

export default function ProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: ToTalkUser;
  onClose: () => void;
  onSaved: (user: ToTalkUser) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (displayName.trim() !== user.displayName) payload.displayName = displayName.trim();
      if (username.trim() !== user.username) payload.username = username.trim();
      if (newPassword) {
        payload.newPassword = newPassword;
        payload.currentPassword = currentPassword;
      }
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { user?: ToTalkUser; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error ?? "Не удалось сохранить");
      onSaved(data.user);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><b>Профиль</b><button onClick={onClose} aria-label="Закрыть">×</button></div>
        <form onSubmit={save}>
          <label>Отображаемое имя<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={32} required /></label>
          <label>Логин<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} required /></label>
          <div className="modal-divider">Смена пароля (необязательно)</div>
          <label>Текущий пароль<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" placeholder="Оставьте пустым, если не меняете пароль" /></label>
          <label>Новый пароль<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
        </form>
      </div>
    </div>
  );
}
