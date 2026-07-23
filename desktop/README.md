# ToTalk Desktop

Desktop-клиент ToTalk на Electron. Он открывает общую production-версию ToTalk,
поэтому аккаунты, серверы, каналы и сообщения синхронизируются с браузером.

## Разработка

```powershell
npm install
npm start
```

## Сборка Windows

```powershell
npm run dist:win
```

Установщик появляется в `release/`.

## Сборка macOS

На компьютере Mac:

```bash
npm install
npm run dist:mac
```

Команда создаёт DMG для Intel и Apple Silicon. Для публичного распространения
понадобятся сертификат Apple Developer и notarization.
