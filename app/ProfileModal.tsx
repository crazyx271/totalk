"use client";

import { FormEvent, useRef, useState } from "react";
import type { ToTalkUser } from "./page";
import Avatar from "./Avatar";
import PositionPicker from "./PositionPicker";
import GiphyPickerModal from "./GiphyPickerModal";
import { CrownIcon, EditIcon, XIcon } from "./Icons";

const BANNER_COLORS = ["#5865F2", "#3BA55D", "#ED4245", "#FAA61A", "#EB459E", "#00B0F4", "#747F8D"];
const BRAND_GRADIENT = "linear-gradient(135deg,#9688ff,#6958df)";

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
  const [bio, setBio] = useState(user.bio ?? "");
  const [bannerColor, setBannerColor] = useState(user.bannerColor);
  const [bannerPath, setBannerPath] = useState(user.bannerPath);
  const [avatarFrame, setAvatarFrame] = useState(user.avatarFrame);
  const [avatarPosition, setAvatarPosition] = useState(user.avatarPosition ?? "50% 50%");
  const [bannerPosition, setBannerPosition] = useState(user.bannerPosition ?? "50% 50%");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarPath, setAvatarPath] = useState(user.avatarPath);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showAvatarGiphy, setShowAvatarGiphy] = useState(false);
  const [showBannerGiphy, setShowBannerGiphy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

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

  async function applyAvatarGif(url: string) {
    setShowAvatarGiphy(false);
    setError("");
    setUploadingAvatar(true);
    try {
      const response = await fetch("/api/profile/avatar/from-gif", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json() as { avatarPath?: string; error?: string };
      if (!response.ok || !data.avatarPath) throw new Error(data.error ?? "Не удалось загрузить GIF");
      setAvatarPath(data.avatarPath);
      onSaved({ ...user, avatarPath: data.avatarPath });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить GIF");
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

  async function uploadBanner(file: File) {
    setError("");
    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append("banner", file);
      const response = await fetch("/api/profile/banner", { method: "POST", body: formData });
      const data = await response.json() as { bannerPath?: string; error?: string };
      if (!response.ok || !data.bannerPath) throw new Error(data.error ?? "Не удалось загрузить баннер");
      setBannerPath(data.bannerPath);
      onSaved({ ...user, avatarPath, bannerPath: data.bannerPath, avatarFrame });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить баннер");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function applyBannerGif(url: string) {
    setShowBannerGiphy(false);
    setError("");
    setUploadingBanner(true);
    try {
      const response = await fetch("/api/profile/banner/from-gif", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json() as { bannerPath?: string; error?: string };
      if (!response.ok || !data.bannerPath) throw new Error(data.error ?? "Не удалось загрузить GIF");
      setBannerPath(data.bannerPath);
      onSaved({ ...user, avatarPath, bannerPath: data.bannerPath, avatarFrame });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить GIF");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function removeBanner() {
    setError("");
    setUploadingBanner(true);
    try {
      const response = await fetch("/api/profile/banner", { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось удалить баннер");
      setBannerPath(null);
      onSaved({ ...user, avatarPath, bannerPath: null, avatarFrame });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Не удалось удалить баннер");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      if (displayName.trim() !== user.displayName) payload.displayName = displayName.trim();
      if (username.trim() !== user.username) payload.username = username.trim();
      if (bio.trim() !== (user.bio ?? "")) payload.bio = bio.trim();
      if (bannerColor !== user.bannerColor) payload.bannerColor = bannerColor;
      if (avatarFrame !== user.avatarFrame) payload.avatarFrame = avatarFrame;
      if (avatarPosition !== (user.avatarPosition ?? "50% 50%")) payload.avatarPosition = avatarPosition;
      if (bannerPosition !== (user.bannerPosition ?? "50% 50%")) payload.bannerPosition = bannerPosition;
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
      onSaved({ ...data.user, avatarPath, bannerPath });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card profile-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть"><XIcon /></button>
        <div className={`profile-banner ${bannerPath ? "has-image" : ""}`} style={bannerPath ? { backgroundImage: `url(${bannerPath})`, backgroundPosition: bannerPosition } : { background: bannerColor ?? BRAND_GRADIENT }}>
          {user.isUltra && (
            <div className="profile-banner-actions">
              <button type="button" className="profile-banner-edit" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner} aria-label="Загрузить баннер">{uploadingBanner ? "…" : <EditIcon />}<span>Файл</span></button>
              <button type="button" className="profile-banner-edit" onClick={() => setShowBannerGiphy(true)} disabled={uploadingBanner} aria-label="Выбрать GIF для баннера"><span>GIF из GIPHY</span></button>
            </div>
          )}
          <button
            type="button"
            className="profile-avatar-edit"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Загрузить фото профиля"
          >
            <Avatar name={displayName} avatarPath={avatarPath} avatarFrame={avatarFrame} avatarPosition={avatarPosition} className="avatar self profile-avatar-large" />
            <span className="profile-avatar-edit-label">{uploadingAvatar ? "…" : <EditIcon />}</span>
          </button>
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadBanner(file);
            event.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={user.isUltra ? "image/png,image/jpeg,image/webp,image/gif" : "image/png,image/jpeg,image/webp"}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadAvatar(file);
            event.target.value = "";
          }}
        />
        <div className="profile-identity">
          <div>
            <div className="profile-name-row"><b>{displayName || user.displayName}</b>{user.isUltra && <span className="ultra-mark" aria-label="Talker Ultra"><CrownIcon /></span>}</div>
            <small>@{username || user.username}</small>
            {user.isUltra && <small className="ultra-hint">GIF-аватар доступен благодаря Talker Ultra</small>}
          </div>
          <div className="profile-identity-actions">
            {user.isUltra && <button type="button" className="profile-avatar-remove" onClick={() => setShowAvatarGiphy(true)} disabled={uploadingAvatar}>GIF из GIPHY</button>}
            {avatarPath && <button type="button" className="profile-avatar-remove" onClick={() => void removeAvatar()} disabled={uploadingAvatar}>Удалить фото</button>}
          </div>
        </div>
        <form className="profile-form" onSubmit={save}>
          <label>Отображаемое имя<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={32} required /></label>
          <label>Логин<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} required /></label>
          <label>О себе<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={190} placeholder="Пара слов о себе" rows={3} /></label>
          <label>Цвет баннера
            <div className="banner-color-row">
              <button
                type="button"
                className={`banner-swatch ${bannerColor === null ? "selected" : ""}`}
                style={{ background: BRAND_GRADIENT }}
                onClick={() => setBannerColor(null)}
                aria-label="Стандартный цвет"
              />
              {BANNER_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={`banner-swatch ${bannerColor === color ? "selected" : ""}`}
                  style={{ background: color }}
                  onClick={() => setBannerColor(color)}
                  aria-label={`Цвет ${color}`}
                />
              ))}
            </div>
          </label>
          {avatarPath && (
            <label>Расположение фото
              <PositionPicker src={avatarPath} shape="circle" value={avatarPosition} onChange={setAvatarPosition} />
            </label>
          )}
          {bannerPath && (
            <label>Расположение баннера
              <PositionPicker src={bannerPath} shape="wide" value={bannerPosition} onChange={setBannerPosition} />
            </label>
          )}
          {user.isUltra && <label>Рамка аватара <span className="field-hint">Тестовые эффекты Talker Ultra</span>
            <div className="avatar-frame-options">
              {[null, "neon", "comet", "emerald"].map((frame) => (
                <button type="button" key={frame ?? "none"} className={`avatar-frame-option ${avatarFrame === frame ? "selected" : ""}`} onClick={() => setAvatarFrame(frame)} aria-label={frame ? `Рамка ${frame}` : "Без рамки"}>
                  <Avatar name={displayName} avatarPath={avatarPath} avatarFrame={frame} className="avatar frame-preview" />
                  <span>{frame === null ? "Нет" : frame === "neon" ? "Неон" : frame === "comet" ? "Комета" : "Изумруд"}</span>
                </button>
              ))}
            </div>
          </label>}
          {user.isUltra && bannerPath && <button type="button" className="profile-banner-remove" onClick={() => void removeBanner()} disabled={uploadingBanner}>Удалить изображение баннера</button>}
          <div className="modal-divider">Смена пароля (необязательно)</div>
          <label>Текущий пароль<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" placeholder="Оставьте пустым, если не меняете пароль" /></label>
          <label>Новый пароль<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
        </form>
      </div>
      {showAvatarGiphy && <GiphyPickerModal title="GIF-аватар из GIPHY" onSelect={(url) => void applyAvatarGif(url)} onClose={() => setShowAvatarGiphy(false)} />}
      {showBannerGiphy && <GiphyPickerModal title="GIF-баннер из GIPHY" onSelect={(url) => void applyBannerGif(url)} onClose={() => setShowBannerGiphy(false)} />}
    </div>
  );
}
