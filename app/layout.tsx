import type { Metadata } from "next";
import { Geist } from "next/font/google";
import DesktopTitleBar from "./DesktopTitleBar";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "ToTalk — общение без границ",
  description: "ToTalk — кроссплатформенное приложение для чатов, друзей, сообществ и звонков.",
  openGraph: {
    title: "ToTalk",
    description: "Общение без границ",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "ToTalk — общение без границ" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body className={geist.variable}><DesktopTitleBar />{children}</body></html>;
}
