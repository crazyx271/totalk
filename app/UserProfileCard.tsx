"use client";

import Avatar from "./Avatar";
import { CalendarIcon, MessageIcon, PhoneIcon, StarIcon, UsersIcon, XIcon } from "./Icons";

const BRAND_GRADIENT = "linear-gradient(135deg,#9688ff,#6958df)";
const MEMBER_SINCE_FORMAT = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

export type ProfileViewedUser = {
  id: number;
  username: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  bannerColor: string | null;
  createdAt: string;
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
        <div className="profile-banner" style={{ background: user.bannerColor ?? BRAND_GRADIENT }}>
          <span className="profile-avatar-edit" aria-hidden="true">
            <Avatar name={user.displayName} avatarPath={user.avatarPath} className="avatar self profile-avatar-large" />
          </span>
        </div>
        <div className="profile-identity">
          <div><b>{user.displayName}</b><small>@{user.username}</small></div>
        </div>
        {user.bio && <p className="profile-bio">{user.bio}</p>}
        <div className="profile-badges">
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
