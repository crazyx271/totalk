import type { Metadata } from "next";
import DownloadCenter from "./DownloadCenter";

export const metadata: Metadata = {
  title: "Скачать ToTalk — Windows, macOS, Linux, Android и iPhone",
  description: "Выберите версию ToTalk для своего устройства или установите веб-приложение.",
};

export default function DownloadPage() {
  return <DownloadCenter />;
}
