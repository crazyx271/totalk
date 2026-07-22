import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "Bosus — общение без границ",
  description: "Кроссплатформенное приложение для чатов, сообществ и звонков.",
  openGraph: {
    title: "Bosus",
    description: "Общение без границ",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Bosus — общение без границ" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body className={geist.variable}>{children}</body></html>;
}
