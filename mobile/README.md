# ToTalk Mobile

Общая нативная оболочка Android/iOS загружает защищённую production-версию `https://totalker.ru`, поэтому аккаунты, друзья, сообщения, файлы и WebRTC-звонки едины на всех устройствах.

## Локальный запуск

```bash
npm install
npm run sync
npm run open:android
```

Для iOS команды `npm run sync` и `npm run open:ios` выполняются на macOS с установленным Xcode. Android требует Android Studio и JDK 21.

Для тестового сервера задайте `TOTALK_MOBILE_URL=https://test.example.com` перед `npm run sync`.

## Идентификаторы магазинов

- Android package: `com.totalk.mobile`
- iOS bundle ID: `com.totalk.mobile`
- Display name: `ToTalk`

Не создавайте другие приложения с этим package/bundle ID в Play Console или App Store Connect.
