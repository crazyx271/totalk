import type { ReactNode } from "react";

export default function Avatar({
  name,
  avatarPath,
  className,
  children,
}: {
  name: string;
  avatarPath?: string | null;
  className: string;
  children?: ReactNode;
}) {
  return (
    <span className={className}>
      {avatarPath ? <img src={avatarPath} alt="" className="avatar-photo" /> : (name.trim().charAt(0).toUpperCase() || "?")}
      {children}
    </span>
  );
}
