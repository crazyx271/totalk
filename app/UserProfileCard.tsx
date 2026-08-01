"use client";

import Avatar from "./Avatar";
import { CalendarIcon, CrownIcon, MessageIcon, PhoneIcon, StarIcon, UsersIcon, XIcon } from "./Icons";

const BRAND_GRADIENT = "linear-gradient(135deg,#9688ff,#6958df)";
const MEMBER_SINCE_FORMAT = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

export type ProfileViewedUser = {
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
  createdAt: string;
  isOnline: boolean;
  isUltra: boolean;
};

export default function UserProfileCard({
  user,
  onClose,
  onMessage,
  onCall,
  isFriend,
}: {
  user: ProfileViewedUser;
  onClose: () => void;
  onMessage?: () => void;
  onCall?: () => void;
  isFriend?: boolean;
}) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card profile-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть"><XIcon /></button>
        <div className={`profile-banner ${user.bannerPath ? "has-image" : ""}`} style={user.bannerPath ? { backgroundImage: `url(${user.bannerPath})`, backgroundPosition: user.bannerPosition ?? "center" } : { background: user.bannerColor ?? BRAND_GRADIENT }}>
          <span className="profile-avatar-edit" aria-hidden="true">
            <Avatar name={user.displayName} avatarPath={user.avatarPath} avatarFrame={user.avatarFrame} avatarPosition={user.avatarPosition} className="avatar self profile-avatar-large">{user.isOnline && <i />}</Avatar>
          </span>
        </div>
        <div className="profile-identity">
          <div>
            <div className="profile-name-row"><b>{user.displayName}</b>{user.isUltra && <span className="ultra-mark" aria-label="Talker Ultra"><CrownIcon /></span>}</div>
            <small>@{user.username}</small>
          </div>
        </div>
        {user.bio && <p className="profile-bio">{user.bio}</p>}
        <div className="profile-badges">
          <span className={`profile-badge ${user.isOnline ? "online" : ""}`}><i className="status-dot" />{user.isOnline ? "В сети" : "Не в сети"}</span>
          {user.isUltra && <span className="profile-badge ultra"><CrownIcon /><span>Talker Ultra</span></span>}
          {isFriend && <span className="profile-badge friend"><UsersIcon /><span>Друзья</span></span>}
          {user.id <= 20 && <span className="profile-badge early"><StarIcon /><span>Ранний участник</span></span>}
          <span className="profile-badge"><CalendarIcon /><span>На ToTalk с {MEMBER_SINCE_FORMAT.format(new Date(`${user.createdAt}Z`))}</span></span>
        </div>
        {(onMessage || onCall) && (
          <div className="profile-actions">
            {onMessage && <button type="button" className="profile-action primary" onClick={onMessage}><MessageIcon /><span>Написать</span></button>}
            {onCall && <button type="button" className="profile-action" onClick={onCall}><PhoneIcon /><span>Позвонить</span></button>}
          </div>
        )}
      </div>
    </div>
  );
}
