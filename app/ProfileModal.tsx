"use client";

import { FormEvent, useRef, useState } from "react";
import type { ToTalkUser } from "./page";
import Avatar from "./Avatar";

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
  const [avatarPath, setAvatarPath] = useState(user.avatarPath);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadAvatar(file: File) {
    setError("");
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const data = await response.json() as { avatarPath?: string; error?: string };
      if (!response.ok || !data.avatarPath) throw new Error(data.error ?? "Не удалось загрузить фото");
      setAvatarPath(data.avatarPath);
      onSaved({ ...user, avatarPath: data.avatarPath });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить фото");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    setError("");
    setUploadingAvatar(true);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось удалить фото");
      setAvatarPath(null);
      onSaved({ ...user, avatarPath: null });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Не удалось удалить фото");
    } finally {
      setUploadingAvatar(false);
    }
  }

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
      onSaved({ ...data.user, avatarPath });
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
        <div className="profile-avatar-row">
          <button
            type="button"
            className="profile-avatar-edit"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Загрузить фото профиля"
          >
            <Avatar name={displayName} avatarPath={avatarPath} className="avatar self profile-avatar-large" />
            <span className="profile-avatar-edit-label">{uploadingAvatar ? "…" : "✎"}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
              event.target.value = "";
            }}
          />
          {avatarPath && <button type="button" className="profile-avatar-remove" onClick={() => void removeAvatar()} disabled={uploadingAvatar}>Удалить фото</button>}
        </div>
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
