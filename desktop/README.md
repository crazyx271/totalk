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

## Автообновление

Приложение проверяет обновления через `electron-updater` (при старте и затем
каждые 4 часа), используя фид по адресу `https://totalker.ru/downloads/`.
Чтобы выпустить новую версию:

1. Поднять `version` в `desktop/package.json`.
2. `npm run dist:win` — соберёт `ToTalk-<version>-win-x64.exe`, `.blockmap`
   и `latest.yml` в `release/`.
3. Залить все три файла на сервер в `/opt/totalk/data/downloads/` (не через git —
   это бинарные артефакты), например:
   ```bash
   scp release/ToTalk-<version>-win-x64.exe release/ToTalk-<version>-win-x64.exe.blockmap release/latest.yml \
     root@<host>:/opt/totalk/data/downloads/
   ssh root@<host> "cp /opt/totalk/data/downloads/ToTalk-<version>-win-x64.exe /opt/totalk/data/downloads/ToTalk-Setup.exe && chown totalk:totalk /opt/totalk/data/downloads/*"
   ```
4. Уже установленные копии приложения подхватят `latest.yml`, скачают
   обновление в фоне и применят его при следующем перезапуске приложения.
   Ссылка `/downloads/ToTalk-Setup.exe` на сайте — стабильное имя для новых
   загрузок, отдельное от файла с версией в имени, который использует
   автообновление.

## Сборка macOS

На компьютере Mac:

```bash
npm install
npm run dist:mac
```

Команда создаёт DMG для Intel и Apple Silicon. Для публичного распространения
понадобятся сертификат Apple Developer и notarization.
