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
