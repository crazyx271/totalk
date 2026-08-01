"use client";

import { useEffect } from "react";

type NativePlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (event: string, callback: (payload: { value?: string }) => void) => Promise<{ remove: () => Promise<void> }>;
};

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      Plugins?: { PushNotifications?: NativePlugin };
    };
  }
}

export default function MobileAppBridge() {
  useEffect(() => {
    const capacitor = window.Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    document.documentElement.classList.add("native-mobile");
    const push = capacitor.Plugins?.PushNotifications;
    if (!push) return () => document.documentElement.classList.remove("native-mobile");
    let disposed = false;
    let registrationListener: { remove: () => Promise<void> } | undefined;
    const enablePush = async () => {
      const current = await push.checkPermissions();
      const permission = current.receive === "prompt" ? await push.requestPermissions() : current;
      if (permission.receive !== "granted" || disposed) return;
      registrationListener = await push.addListener("registration", ({ value }) => {
        if (!value) return;
        void fetch("/api/push-tokens", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: value, platform: capacitor.getPlatform?.() }),
        });
      });
      await push.register();
    };
    const onFirstInteraction = () => void enablePush().catch(() => undefined);
    window.addEventListener("pointerdown", onFirstInteraction, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", onFirstInteraction);
      void registrationListener?.remove();
      document.documentElement.classList.remove("native-mobile");
    };
  }, []);
  return null;
}
