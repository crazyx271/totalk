"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return navigator.userAgent.includes("Electron");
}

function getServerSnapshot() {
  return false;
}

export function useIsDesktopApp() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
