# ToTalk

ToTalk — кроссплатформенное приложение для общения: серверы и каналы,
друзья, личные сообщения, голосовые комнаты и личные звонки.

## Возможности

- собственная регистрация и вход;
- серверы, текстовые каналы и постоянная история сообщений;
- поиск пользователей, заявки и список друзей;
- личные сообщения;
- голосовые комнаты и личные WebRTC-звонки;
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

Проект использует Vinext, Cloudflare D1, Drizzle ORM, Electron и WebRTC.

## Голос в production

Для WebRTC в реальном продакшене одного STUN недостаточно. Если у двух пользователей сложный NAT, CGNAT или симметричный NAT, браузеры могут обменяться сигналингом, но аудиопоток напрямую не пойдёт. Для этого нужен TURN relay.

ToTalk уже умеет:

- получать ICE-конфигурацию через [app/api/voice/ice/route.ts](app/api/voice/ice/route.ts);
- отдавать STUN по умолчанию;
- отдавать TURN только авторизованным пользователям;
- генерировать временные TURN credentials через `TURN_SECRET` для coturn REST auth.
- отдавать healthcheck через [app/api/health/route.ts](app/api/health/route.ts).

## Deploy v1

Минимальный контур для первой версии:

1. Развернуть веб-приложение на Cloudflare Workers с D1 binding `DB`.
2. Применить миграции из папки `drizzle` к production D1.
3. Задать `SITE_URL`, `TURN_URLS`, `TURN_SECRET` и `TURN_TTL_SECONDS`.
4. Поднять coturn с тем же секретом, что и `TURN_SECRET`.
5. Проверить `/api/health` после деплоя.
6. Перед релизом запускать `npm run validate`.

### Быстрое подключение к Cloudflare

1. Войдите в Cloudflare CLI:

```bash
npx wrangler login
```

2. Создайте production D1:

```bash
npx wrangler d1 create totalk-prod
```

3. Скопируйте `database_id` из ответа и вставьте его в [wrangler.jsonc](wrangler.jsonc) вместо `REPLACE_WITH_D1_DATABASE_ID`.

4. Отредактируйте в [wrangler.jsonc](wrangler.jsonc) значения:

```txt
SITE_URL=https://app.your-domain.example
TURN_URLS=turn:turn.your-domain.example:3478?transport=udp,turn:turn.your-domain.example:3478?transport=tcp
TURN_TTL_SECONDS=3600
```

5. Задайте TURN secret:

```bash
npx wrangler secret put TURN_SECRET
```

6. Примените D1-миграции:

```bash
npm run cf:d1:migrate
```

7. Задеплойте приложение:

```bash
npm run cf:deploy
```

8. После деплоя привяжите custom domain `app.your-domain.example` к worker в панели Cloudflare и проверьте:

```txt
https://app.your-domain.example/api/health
```

Для desktop-клиента задайте:

```txt
TOTALK_URL=https://app.your-domain.example/
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
