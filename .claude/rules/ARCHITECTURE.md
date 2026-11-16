# Архитектура

## Стек

- React 18 + TypeScript + Vite 5, `react-router-dom` 6 (`HashRouter`)
- zod — схемы данных; pdfjs-dist — просмотр PDF; qrcode — QR внешних ссылок
- vite-plugin-pwa (Workbox) — офлайн-кэш
- Vitest + Testing Library (jsdom); tsx — скрипт проверки контента
- Хостинг: статика за nginx на VPS Reg.ru 80.78.253.231, `kiosk.339933.net`

## Команды

- Тесты: `npm test`
- Dev: `npm run dev`
- Сборка: `npm run build`
- Контент: `npm run check-content`

## Дерево

```
public/data/     — clinic, doctors, documents, authorities (.json) — источник правды
public/docs/     — PDF-документы
src/data/        — схемы, загрузка, DataProvider
src/legal/       — 28 пунктов требований, расчёт покрытия
src/kiosk/       — оболочка киоска: простой, баннер, защита ввода
src/ui/          — Tile, ScreenLayout, Logo
src/external/    — QR-модал внешних ссылок
src/screens/     — экраны
src/pdf/         — просмотрщик PDF
scripts/         — check-content
deploy/          — nginx, runbook, настройка киоска
tests/           — зеркалит src/
```

## Модули

- data — загрузка/валидация JSON, ретрай 30 с.
- legal — список пунктов и `computeCoverage`.
- kiosk — сброс на главную через 90 с простоя, баннер приостановки (п. 27).
- external — QR вместо перехода на внешний сайт.
- screens, pdf — UI.

Детальной документации модулей (`.claude/docs/`) пока нет.

### Базовый образ

Отсутствует — проект не использует пред-собранный base image для кэша зависимостей.
