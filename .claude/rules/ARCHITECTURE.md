# Архитектура

## Стек

- React 18 + TypeScript + Vite 5, `react-router-dom` 6 (`HashRouter`)
- zod — схемы данных; pdfjs-dist — просмотр PDF; qrcode — QR внешних ссылок
- vite-plugin-pwa (Workbox) — офлайн-кэш
- Vitest + Testing Library (jsdom); tsx — скрипт проверки контента
- Программа-киоск (Windows exe): Electron 45 + electron-builder (NSIS), esbuild; блокировка Windows — PowerShell-скрипты
- Админка: Fastify 5 + bcryptjs + sharp (сервер, Docker), React (веб, `/admin/`), esbuild — сборка сервера
- Хостинг: статика за nginx на VPS Reg.ru 80.78.253.231, `kiosk.339933.net`; админка — `kiosk.339933.net/admin/` → контейнер `127.0.0.1:8096`

## Команды

- Тесты: `npm test`
- Dev: `npm run dev`
- Сборка: `npm run build`
- Контент: `npm run check-content`
- Админка: `npm run admin:test` (тесты), `npm run admin:build` (веб + сервер), `npm run admin:web` (dev, прокси на :8787)
- Программа-киоск: `npm --prefix app test`, `npm --prefix app run build`, `npm --prefix app run dist:win` (установщик в `app/release/`); релиз — тег `app-v<версия>` → GitHub Actions на Windows (https://github.com/GinaliArseny/maxima-kiosk/releases); на Mac для проверки — `KIOSK_DEV=1 npx --prefix app electron app`
- Деплой: `deploy/README.md`; настройка компьютера киоска: `deploy/kiosk-setup.md`

## Дерево

```
public/data/     — стартовое наполнение (clinic, doctors, documents, authorities, screensaver); на сервере источник правды — content/
public/docs/     — PDF-документы (стартовые)
admin/server/    — сервер админки: ContentStore, загрузки, API, вход
admin/web/       — веб-админка (React)
admin/shared/    — общее для сервера и веба (slug)
app/             — программа-киоск (Electron): окно, PIN-выход, заставка из Jellyfin, самопроверка защиты
deploy/windows/  — install/uninstall-kiosk.ps1, watchdog.ps1 — блокировка Windows для учётки «Киоск»
src/data/        — схемы, загрузка, DataProvider
src/legal/       — 28 пунктов требований, расчёт покрытия
src/kiosk/       — оболочка киоска: простой, баннер, защита ввода
src/ui/          — Tile, ScreenLayout, Logo
src/external/    — QR-модал внешних ссылок
src/screens/     — экраны
src/pdf/         — просмотрщик PDF
scripts/         — check-content, strip-content (данные вне сборки)
deploy/          — nginx, runbook, настройка киоска
tests/           — зеркалит src/
```

## Модули

- data — загрузка/валидация JSON, ретрай 30 с.
- legal — список пунктов и `computeCoverage`.
- kiosk — сброс на главную через 90 с простоя, перезагрузка при смене data/version.json, баннер приостановки (п. 27).
- app — программа-киоск: разрешены только kiosk.339933.net (без /admin) и игра; выход 5 касаний в углу + PIN; заставка по простою системы — ролики Jellyfin (пользователь kiosk, не ключ API).
- admin — правка данных киоска админом клиники: проверка той же схемой, атомарная запись, история с откатом, version.json.
- external — QR вместо перехода на внешний сайт.
- screens, pdf — UI.

Детальной документации модулей (`.claude/docs/`) пока нет.

### Базовый образ

Отсутствует — проект не использует пред-собранный base image для кэша зависимостей.
