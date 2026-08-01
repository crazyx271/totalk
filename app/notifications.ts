import { playNotificationTone } from "./callSounds";

export async function enableBrowserNotifications() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return await Notification.requestPermission() === "granted";
}

export async function showToTalkNotification(title: string, body: string, onOpen?: () => void) {
  playNotificationTone();
  if (window.totalkDesktop?.showNotification) {
    await window.totalkDesktop.showNotification({ title, body });
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const notification = new Notification(title, { body, icon: "/favicon.svg", tag: `totalk-${Date.now()}` });
  notification.onclick = () => { window.focus(); onOpen?.(); notification.close(); };
}
