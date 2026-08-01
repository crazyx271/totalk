import type { ReactNode } from "react";

export default function Avatar({
  name,
  avatarPath,
  avatarFrame,
  className,
  children,
}: {
  name: string;
  avatarPath?: string | null;
  avatarFrame?: string | null;
  className: string;
  children?: ReactNode;
}) {
  return (
    <span className={`${className}${avatarFrame ? ` avatar-frame avatar-frame-${avatarFrame}` : ""}`}>
      {avatarPath ? <img src={avatarPath} alt="" className="avatar-photo" /> : (name.trim().charAt(0).toUpperCase() || "?")}
      {children}
    </span>
  );
}
