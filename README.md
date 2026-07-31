# ToTalk

ToTalk — кроссплатформенное приложение для общения: серверы и каналы,
друзья, личные сообщения, голосовые комнаты и личные звонки.

## Возможности

- собственная регистрация и вход;
- серверы, текстовые каналы и постоянная история сообщений;
- поиск пользователей, заявки и список друзей;
- личные сообщения;
- голосовые комнаты и личные WebRTC-звонки с видео;
- адаптивная браузерная версия;
- desktop-клиент для Windows и macOS на Electron.

## Запуск веб-версии

Требуется Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Проверка production-сборки:

```bash
npm run build
```

Полная проверка релизной готовности:

```bash
npm run validate
```

## Desktop

```bash
cd desktop
npm install
npm run start
```

Сборка установщика Windows:

```bash
npm run dist:win
```

Проект использует Vinext (сборка через Nitro/Node), SQLite (Drizzle ORM), Electron и WebRTC. Приложение — обычный Node-сервер, разворачивается на своём VDS, без привязки к облачному провайдеру.

## Голос в production

Для WebRTC в реальном продакшене одного STUN недостаточно. Если у двух пользователей сложный NAT, CGNAT или симметричный NAT, браузеры могут обменяться сигналингом, но аудиопоток напрямую не пойдёт. Для этого нужен TURN relay.

ToTalk уже умеет:

- получать ICE-конфигурацию через [app/api/voice/ice/route.ts](app/api/voice/ice/route.ts);
- отдавать STUN по умолчанию;
- отдавать TURN только авторизованным пользователям;
- генерировать временные TURN credentials через `TURN_SECRET` для coturn REST auth.
- отдавать healthcheck через [app/api/health/route.ts](app/api/health/route.ts).

## Deploy v1 — свой VDS

Минимальный контур для первой версии — один VDS под сайт и coturn.

Ориентир по серверу (проверено на практике): Ubuntu 24.04/26.04, 2 vCPU, 4 ГБ RAM, 50 ГБ NVMe, канал от 1 Гбит/с (важно для видео — TURN-relay трафик может быть заметным), один публичный IP.

1. Установить на сервере Node.js `>=22.13.0` и git.
2. Склонировать репозиторий и выполнить `npm install`.
3. Создать `.env` из [.env.example](.env.example): задать `SITE_URL`, `DATABASE_PATH`, `TURN_URLS`, `TURN_SECRET`, `TURN_TTL_SECONDS`.
4. Применить миграции к SQLite: `npm run db:migrate`.
5. Собрать приложение: `npm run build`.
6. Запустить как systemd-сервис (см. ниже) и поднять обратный прокси с TLS.
7. Поднять coturn с тем же секретом, что и `TURN_SECRET` (см. ниже).
8. Проверить `/api/health` после деплоя.
9. Перед релизом запускать `npm run validate`.

### Systemd-сервис

Создайте `/etc/systemd/system/totalk.service`:

```ini
[Unit]
Description=ToTalk web app
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/totalk
EnvironmentFile=/opt/totalk/.env
Environment=PORT=3000
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=on-failure
User=totalk

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now totalk
sudo journalctl -u totalk -f
```

### Обратный прокси и TLS (Caddy)

Статику (`/assets/*`) отдаёт сам Caddy напрямую с диска — быстрее, чем гонять через Node, и не зависит от особенностей раздачи статики в самом сервере:

```
your-domain.example {
  root * /opt/totalk/dist/standalone/dist/client
  @assets path /assets/*
  handle @assets {
    header Cache-Control "public, max-age=31536000, immutable"
    file_server
  }
  handle {
    reverse_proxy localhost:3000
  }
}
```

Caddy сам получит и обновит сертификат Let's Encrypt. После первого запуска проверьте:

```txt
https://your-domain.example/api/health
```

Для desktop-клиента задайте:

```txt
TOTALK_URL=https://your-domain.example/
```

### Обязательные переменные для голоса

Укажите как минимум:

```txt
SITE_URL=https://your-domain.example
TURN_URLS=turn:turn.your-domain.example:3478?transport=udp,turn:turn.your-domain.example:3478?transport=tcp
TURN_SECRET=replace-with-a-long-random-secret
TURN_TTL_SECONDS=3600
```

Если не используете временные credentials, можно вместо `TURN_SECRET` задать статические:

```txt
TURN_USERNAME=totalk
TURN_CREDENTIAL=replace-with-a-strong-password
```

### Рекомендуемая схема coturn

На TURN-сервере должна быть включена REST-аутентификация с тем же секретом:

```txt
use-auth-secret
static-auth-secret=replace-with-a-long-random-secret
realm=turn.your-domain.example
listening-port=3478
fingerprint
total-quota=0
bps-capacity=0
no-cli
```

Минимально откройте:

- UDP/TCP `3478`;
- relay-диапазон портов coturn;
- HTTPS-домен приложения, чтобы браузер разрешал микрофон.

### Что такое NAT и почему он ломает звонки

NAT это механизм, при котором много устройств сидят за одним внешним IP. Для обычного HTTP это удобно, но для peer-to-peer звонков создаёт проблему: браузер знает свой локальный адрес, но другой пользователь не может достучаться до него напрямую.

Как работает WebRTC:

1. STUN помогает узнать внешний адрес и попытаться соединить пользователей напрямую.
2. Если оба NAT простые, голос идёт peer-to-peer.
3. Если один из NAT строгий или симметричный, прямой маршрут не строится.
4. TURN в этом случае становится промежуточным relay, через который проходит аудио.

Итог простой: без TURN звонки будут работать только у части пользователей. Для полноценного продукта TURN обязателен.

Видео тяжелее аудио на порядок: одна камера — это уже сотни кбит/с - несколько мбит/с на пир, а схема соединений в ToTalk сейчас mesh (каждый со всеми). Для небольших комнат (звонок 1:1, компания из нескольких друзей) это нормально. Если понадобятся комнаты с большим числом одновременно включённых камер, потребуется SFU — mesh перестаёт масштабироваться. Также заложите в coturn запас по трафику: `total-quota=0` и `bps-capacity=0` из рекомендованной схемы ниже уже снимают лимиты, но сам сервер должен физически тянуть исходящий видеотрафик relay.

## Тестовый контур перед продакшеном

Прежде чем катить новые голос/видео изменения на прод, поднимите тот же контур на отдельном небольшом VDS (или отдельный systemd-сервис + отдельный сайт в Caddyfile + свой `DATABASE_PATH`/поддомен на том же сервере, если второй VDS не нужен) — так ничего не заденет продакшен-базу и продакшен-пользователей.

1. Повторите шаги из раздела «Deploy v1» выше: `.env` со своим `SITE_URL` (тестовый (под)домен) и своим `DATABASE_PATH` (например, `/opt/totalk-test/data/totalk.sqlite`), `npm run db:migrate`, `npm run build`.
2. TURN можно переиспользовать тот же coturn, что и в проде, если для теста достаточно одного relay — секрет `TURN_SECRET` тогда просто совпадает в обоих `.env`.
3. Заведите отдельный systemd-юнит (`totalk-test.service`) и отдельный блок в Caddyfile на тестовый (под)домен.
4. Проверьте `https://<test-domain>/api/health`.

### Чек-лист ручной проверки голоса и видео

- Два разных аккаунта-друга, звонок 1:1: включить камеру с обеих сторон, убедиться что видно оба потока и работает mute.
- Выключить камеру во время звонка — собеседник должен увидеть, что видео пропало, звук должен продолжать идти.
- Тот же сценарий в общем голосовом канале ToTalk с 2-3 вкладками.
- Проверить звонок между двумя разными сетями (например, мобильный интернет + Wi-Fi), чтобы убедиться, что TURN relay реально работает, а не только прямой P2P в одной сети.
- Desktop-клиент (`cd desktop && npm run start` с `TOTALK_URL`, указывающим на тестовый сервер): убедиться, что запрос доступа к камере больше не блокируется.

После успешной проверки на тестовом контуре повторите шаги деплоя для продакшена (см. раздел «Deploy v1» выше).
