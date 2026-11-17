# Архитектура

## Стек

- React 18 + TypeScript + Vite 5, `react-router-dom` 6 (`HashRouter`)
- zod — схемы данных; pdfjs-dist — просмотр PDF; qrcode — QR внешних ссылок
- vite-plugin-pwa (Workbox) — офлайн-кэш
- Vitest + Testing Library (jsdom); tsx — скрипт проверки контента
- Админка: Fastify 5 + bcryptjs + sharp (сервер, Docker), React (веб, `/admin/`), esbuild — сборка сервера
- Хостинг: статика за nginx на VPS Reg.ru 80.78.253.231, `kiosk.339933.net`; админка — `kiosk.339933.net/admin/` → контейнер `127.0.0.1:8096`

## Команды

- Тесты: `npm test`
- Dev: `npm run dev`
- Сборка: `npm run build`
- Контент: `npm run check-content`
- Админка: `npm run admin:test` (тесты), `npm run admin:build` (веб + сервер), `npm run admin:web` (dev, прокси на :8787)
- Деплой: `deploy/README.md`

## Дерево

```
public/data/     — стартовое наполнение (clinic, doctors, documents, authorities, screensaver); на сервере источник правды — content/
public/docs/     — PDF-документы (стартовые)
admin/server/    — сервер админки: ContentStore, загрузки, API, вход
admin/web/       — веб-админка (React)
admin/shared/    — общее для сервера и веба (slug)
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
- admin — правка данных киоска админом клиники: проверка той же схемой, атомарная запись, история с откатом, version.json.
- external — QR вместо перехода на внешний сайт.
- screens, pdf — UI.

Детальной документации модулей (`.claude/docs/`) пока нет.

### Базовый образ

Отсутствует — проект не использует пред-собранный base image для кэша зависимостей.
