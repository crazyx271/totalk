"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { DownloadIcon } from "../Icons";

type Platform = "windows" | "mac" | "linux" | "android" | "ios" | "web";

const PLATFORM_LABELS: Record<Platform, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iPhone / iPad",
  web: "браузер",
};

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "web";
}

export default function DownloadCenter() {
  const platform = useSyncExternalStore(
    () => () => undefined,
    detectPlatform,
    () => "web" as Platform,
  );

  return (
    <main className="download-page">
      <header className="download-header">
        <Link className="public-brand" href="/"><span>T</span><b>ToTalk</b></Link>
        <Link className="public-secondary compact" href="/">Открыть веб-версию</Link>
      </header>

      <section className="download-intro">
        <span className="public-eyebrow"><i /> Для каждого устройства</span>
        <h1>Скачайте ToTalk.</h1>
        <p>Продолжайте разговор на компьютере, телефоне или прямо в браузере. Ваши чаты и контакты останутся на месте.</p>
        <div className="detected-platform">Мы определили ваше устройство: <b>{PLATFORM_LABELS[platform]}</b></div>
      </section>

      <section className="download-grid" aria-label="Доступные версии ToTalk">
        <article className={`download-card ${platform === "windows" ? "recommended" : ""}`}>
          <div className="download-os-icon windows">W</div>
          <span className="download-status ready">Доступно</span>
          <h2>Windows</h2>
          <p>Для Windows 10 и 11, 64-bit. Установщик с автоматическими обновлениями.</p>
          <a className="download-action" href="/downloads/ToTalk-Setup.exe" download><DownloadIcon />Скачать для Windows</a>
          {platform === "windows" && <small className="recommended-label">Рекомендуется для вас</small>}
        </article>

        <article className={`download-card ${platform === "mac" ? "recommended" : ""}`}>
          <div className="download-os-icon mac">⌘</div>
          <span className="download-status beta">Тестовая версия</span>
          <h2>macOS</h2>
          <p>Отдельные сборки для новых Mac с Apple Silicon и моделей на Intel.</p>
          <div className="download-card-actions">
            <a className="download-action" href="/downloads/ToTalk-0.2.0-mac-arm64.dmg" download><DownloadIcon />Apple Silicon</a>
            <a className="download-action secondary" href="/downloads/ToTalk-0.2.0-mac-x64.dmg" download>Intel</a>
          </div>
          <small>Пока без подписи Apple — при первом запуске используйте правую кнопку → «Открыть».</small>
          {platform === "mac" && <small className="recommended-label">Рекомендуется для вас</small>}
        </article>

        <article className={`download-card ${platform === "linux" ? "recommended" : ""}`}>
          <div className="download-os-icon linux">L</div>
          <span className="download-status ready">Веб-приложение</span>
          <h2>Linux</h2>
          <p>Полная браузерная версия. Её можно закрепить как отдельное приложение через меню браузера.</p>
          <Link className="download-action" href="/">Открыть ToTalk</Link>
          {platform === "linux" && <small className="recommended-label">Рекомендуется для вас</small>}
        </article>

        <article className={`download-card ${platform === "android" ? "recommended" : ""}`}>
          <div className="download-os-icon android">A</div>
          <span className="download-status soon">Магазин — скоро</span>
          <h2>Android</h2>
          <p>Нативное приложение готовится к публикации. Сейчас используйте устанавливаемую веб-версию.</p>
          <Link className="download-action" href="/">Открыть веб-версию</Link>
          <small>В Chrome: меню ⋮ → «Добавить на главный экран».</small>
          {platform === "android" && <small className="recommended-label">Для вашего устройства</small>}
        </article>

        <article className={`download-card ${platform === "ios" ? "recommended" : ""}`}>
          <div className="download-os-icon ios">i</div>
          <span className="download-status soon">App Store — скоро</span>
          <h2>iPhone и iPad</h2>
          <p>Пока доступна веб-версия с запуском с домашнего экрана.</p>
          <Link className="download-action" href="/">Открыть веб-версию</Link>
          <small>В Safari: «Поделиться» → «На экран Домой».</small>
          {platform === "ios" && <small className="recommended-label">Для вашего устройства</small>}
        </article>

        <article className={`download-card web-card ${platform === "web" ? "recommended" : ""}`}>
          <div className="download-os-icon web">◎</div>
          <span className="download-status ready">Всегда доступно</span>
          <h2>Любой браузер</h2>
          <p>Ничего не устанавливайте. Войдите с любого современного браузера и продолжайте общение.</p>
          <Link className="download-action" href="/">Запустить ToTalk</Link>
        </article>
      </section>

      <section className="download-help">
        <div><span>01</span><p><b>Один аккаунт</b>Войдите с тем же логином на любом устройстве.</p></div>
        <div><span>02</span><p><b>Общие чаты</b>Сообщения, друзья и файлы синхронизируются.</p></div>
        <div><span>03</span><p><b>Выбор за вами</b>Приложение или браузер — ToTalk работает везде.</p></div>
      </section>

      <footer className="public-footer download-footer">
        <Link className="public-brand" href="/"><span>T</span><b>ToTalk</b></Link>
        <p>© {new Date().getFullYear()} ToTalk</p>
        <Link href="/">Вернуться на главную</Link>
      </footer>
    </main>
  );
}
