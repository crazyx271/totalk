"use client";

import { useEffect, useState } from "react";
import { useIsDesktopApp } from "./useIsDesktopApp";
import { WindowMaximizeIcon, WindowMinimizeIcon, WindowRestoreIcon, XIcon } from "./Icons";

declare global {
  interface Window {
    totalkDesktop?: {
      minimizeWindow: () => Promise<boolean>;
      toggleMaximizeWindow: () => Promise<boolean>;
      closeWindow: () => Promise<boolean>;
      isWindowMaximized: () => Promise<boolean>;
      toggleFullscreenWindow: () => Promise<boolean>;
      isWindowFullscreen: () => Promise<boolean>;
      showNotification: (payload: { title: string; body: string }) => Promise<boolean>;
      onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
      onWindowFullscreenChange: (callback: (fullscreen: boolean) => void) => () => void;
    };
  }
}

export default function DesktopTitleBar() {
  const isDesktop = useIsDesktopApp();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    document.documentElement.classList.add("has-desktop-titlebar");
    return () => document.documentElement.classList.remove("has-desktop-titlebar");
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop || !window.totalkDesktop) return;
    const api = window.totalkDesktop;
    api.isWindowMaximized().then(setMaximized);
    return api.onWindowMaximizedChange(setMaximized);
  }, [isDesktop]);

  if (!isDesktop) return null;

  return (
    <div className="desktop-titlebar">
      <div className="desktop-titlebar-brand"><span>T</span>ToTalk</div>
      <div className="desktop-titlebar-controls">
        <button type="button" onClick={() => void window.totalkDesktop?.minimizeWindow()} aria-label="Свернуть"><WindowMinimizeIcon /></button>
        <button type="button" onClick={() => void window.totalkDesktop?.toggleMaximizeWindow()} aria-label={maximized ? "Восстановить" : "Развернуть"}>
          {maximized ? <WindowRestoreIcon /> : <WindowMaximizeIcon />}
        </button>
        <button type="button" className="desktop-titlebar-close" onClick={() => void window.totalkDesktop?.closeWindow()} aria-label="Закрыть"><XIcon /></button>
      </div>
    </div>
  );
}
