# Киоск «Максима» — правила работы

Touch-сайт для инфокиоска (~40", Windows, Chrome в kiosk-режиме) в холле СЦ «Максима»: юридическая информация стенда (28 пунктов), приветствие, кнопка детской игры.

## Команды

- Тесты: `npm test` (Vitest + Testing Library, jsdom)
- Dev-сервер: `npm run dev`
- Сборка: `npm run build` → `dist/`
- Проверка полноты контента: `npm run check-content` (таблица 28 пунктов, exit 1 при дыре)
- Деплой: см. `deploy/README.md` (rsync `dist/` на VPS Reg.ru 80.78.253.231, `kiosk.339933.net`)

## Паттерны

- Данные — только в `public/data/*.json` (+ PDF в `public/docs/`). В компонентах никаких захардкоженных реквизитов/врачей/документов. Схемы — `src/data/schema.ts` (zod), они же типы.
- Нет данных → элемента нет на экране. Никаких заглушек «скоро будет». Пока `clinic.demo: true` — на экране лента «ДЕМО-ДАННЫЕ».
- Внешние URL никогда не открываются навигацией — только через `useExternalLink().open()` (QR-модал). Исключение — `clinic.gameUrl` (переход в той же вкладке).
- Без аналитики, cookies, CDN, форм и полей ввода.
- Touch: цели ≥ 72 px, шрифт ≥ 24 px, никаких hover-состояний.
- TDD, тесты поведенческие через `renderApp()` (`tests/helpers/renderApp.tsx`) на фикстурах `tests/fixtures/data/` — боевые `public/data/` тесты не читают; мокаем только границы: `fetch`, pdf.js, время. Названия тестов — на русском.
- Сведения о документах врачей (`credentials[].details`) — дословно с сайта клиники, не перефразировать.
- Коммиты: короткое русское описание без номера задачи, без упоминаний AI.

## Документы

- Спека: `docs/superpowers/specs/2026-11-16-maxima-kiosk-design.md`
- План: `docs/superpowers/plans/2026-11-16-maxima-kiosk.md`
- Требования юристов: `docs/legal/requirements-stand.doc`
