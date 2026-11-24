# Киоск «Максима» — правила работы

Touch-сайт для инфокиоска (~40", Windows, программа-киоск на Electron из `app/`) в холле СЦ «Максима»: юридическая информация стенда (28 пунктов), приветствие, кнопка детской игры.

## Команды

- Тесты: `npm test` (Vitest + Testing Library, jsdom)
- Dev-сервер: `npm run dev`
- Сборка: `npm run build` → `dist/`
- Проверка полноты контента: `npm run check-content` (таблица 28 пунктов, exit 1 при дыре)
- Админка: `npm run admin:test`, `npm run admin:build`
- Тестовая версия 0.1.4: отдельный `ru.maxima.kiosk.test`, MaximaKioskTest, профиль `%APPDATA%\MaximaKioskTest`; без автозапуска и скриптов. Инструкция: `deploy/kiosk-test.md`.
- Программа-киоск: `npm --prefix app test`, `npm --prefix app run dist:win`; настройка ПК — `deploy/kiosk-setup.md`
- Релиз программы-киоска: поднять `version` в `app/package.json` (и `APP_VERSION` в `app/src/jellyfin.ts`), тег `app-v<версия>` → GitHub Actions (`.github/workflows/kiosk-app.yml`) соберёт exe на Windows, проверит обновление и аварийный выход (`app/ci/smoke.ps1`) и выложит релиз. Репо публичный: никаких секретов в коммитах
- Деплой: см. `deploy/README.md` (rsync `dist/` **с --exclude data/ docs/ doctors/** на VPS Reg.ru 80.78.253.231, `kiosk.339933.net`; админка — Docker)

## Паттерны

- Данные киоска на сервере живут в `/opt/maxima-kiosk/content/` и правятся админкой (`kiosk.339933.net/admin/`) — это источник правды; `public/data` в репо — стартовое наполнение и данные для разработки. Ключей/паролей (Jellyfin и т. п.) в публичных JSON и в репо нет.
- Данные — только в JSON (+ PDF). В компонентах никаких захардкоженных реквизитов/врачей/документов. Схемы — `src/data/schema.ts` (zod), они же типы.
- Нет данных → элемента нет на экране. Никаких заглушек «скоро будет». Пока `clinic.demo: true` — на экране лента «ДЕМО-ДАННЫЕ».
- Внешние URL никогда не открываются навигацией — только через `useExternalLink().open()` (QR-модал). Исключение — `clinic.gameUrl` (переход в той же вкладке).
- Без аналитики, cookies, CDN, форм и полей ввода.
- Touch: цели ≥ 72 px, шрифт ≥ 24 px, никаких hover-состояний.
- TDD, тесты поведенческие через `renderApp()` (`tests/helpers/renderApp.tsx`) на фикстурах `tests/fixtures/data/` — боевые `public/data/` тесты не читают; мокаем только границы: `fetch`, pdf.js, время. Названия тестов — на русском.
- Сведения о документах врачей (`credentials[].details`) — дословно с сайта клиники, не перефразировать.
- Коммиты: короткое русское описание без номера задачи, без упоминаний AI.

## Документы

- Спека v1: `docs/superpowers/specs/2026-11-16-maxima-kiosk-design.md`, план: `docs/superpowers/plans/2026-11-16-maxima-kiosk.md`
- Спека этапа 2 (программа-киоск, заставка, админка): `docs/superpowers/specs/2026-11-17-kiosk-app-admin-design.md`; планы: `docs/superpowers/plans/2026-11-17-kiosk-admin.md`, `docs/superpowers/plans/2026-11-17-kiosk-app.md`
- Требования юристов: `docs/legal/requirements-stand.doc`
