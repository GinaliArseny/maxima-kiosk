# Киоск «Максима» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Touch-first сайт для инфокиоска в холле «Максимы», закрывающий 28 юридических пунктов стенда, с приветствием и (условной) кнопкой детской игры.

**Architecture:** React SPA (hash-роутер) читает `public/data/*.json` в рантайме, валидирует zod-схемами и раздаёт данные через контекст. Документы — PDF в `public/docs/`, открываются во встроенном просмотрщике на pdf.js; внешние ссылки только как QR. Поверх — киоск-оболочка: сброс на главную по простою, блокировка зума/выделения, баннер приостановки, офлайн-кэш service worker.

**Tech Stack:** React 18.3 + @fontsource/mulish 5 + TypeScript 5.6 + Vite 5.4; react-router-dom 6.28 (`HashRouter`); zod 3.23; pdfjs-dist 4.10; qrcode 1.5; vite-plugin-pwa 0.21; Vitest 2.1 + @testing-library/react 16 + @testing-library/user-event 14 + jsdom 25; tsx 4 (скрипт проверки).

**Spec:** `docs/superpowers/specs/2026-11-16-maxima-kiosk-design.md`

## Global Constraints

- Корень проекта: `~/maxima-kiosk` (отдельный git-репозиторий, не в репо бота).
- Весь UI-текст — на русском. Без UI-кита: CSS-переменные с токенами бренда.
- Бренд: шрифт Mulish через `@fontsource/mulish` (бандлится, без CDN), акцент `#788BFF`, акцент-тёмный `#5465FF`, текст `#222222`, фон `#F5F5F5`.
- Цель касания ≥ 72×72 px; базовый шрифт ≥ 24 px; никаких hover-зависимых состояний.
- Простой `90 000` мс → главная, все модалки закрыты.
- Никаких внешних запросов в рантайме: без аналитики, cookies, CDN, форм и полей ввода.
- Внешний URL никогда не открывается навигацией — только QR-модал.
- Плитка игры рендерится только при заданном `clinic.gameUrl`; переход — `window.location.assign(gameUrl)` в той же вкладке.
- Нет данных → элемента нет на экране (никаких заглушек «скоро будет»). При `clinic.demo === true` на всех экранах лента «ДЕМО-ДАННЫЕ».
- Таймзона для «сегодня»: `Europe/Moscow`.
- Тесты — поведенческие через публичный интерфейс (рендер + клики); мокаем только границы: `fetch`, pdf.js, время (`vi.useFakeTimers`). Докстринги/названия тестов — на русском.
- Коммиты: короткое русское описание без номера задачи (номеров в проекте нет). Никаких `Co-Authored-By` и упоминаний AI.

## Review Focus

- PDF не загрузился (нет файла / офлайн без кэша) → просмотрщик показывает «Документ временно недоступен» и «Назад», а не вечный спиннер. Тест — Task 8.
- Врач с частичными данными (нет аккредитации, пустой день в графике) → строки без данных не выводятся, нигде нет `undefined`/пустых ячеек. Тест — Task 7.
- Баннер приостановки с `to` в прошлом → не показывается, даже если `active: true`. Тест — Task 3.
- Простой при открытом QR-модале или PDF → киоск на главной, модал закрыт. Тест — Task 5.
- `data/*.json` не загрузился при старте → экран «Информация временно недоступна» и автоповтор каждые 30 с, без белого экрана. Тест — Task 1.

---

## Карта файлов

```
.claude/CLAUDE.md, .claude/rules/ARCHITECTURE.md   — проектные правила / архитектура (рус.)
index.html, vite.config.ts, tsconfig.json, package.json
public/data/{clinic,doctors,documents,authorities}.json  — данные (демо-сид)
public/docs/*.pdf                                    — документы (демо: sample.pdf)
src/main.tsx                 — вход, HashRouter
src/App.tsx                  — провайдеры + маршруты
src/theme/tokens.css, global.css
src/data/schema.ts           — zod-схемы + типы
src/data/load.ts             — loadKioskData
src/data/DataProvider.tsx    — загрузка/ретрай, useKioskData
src/legal/requirements.ts    — 28 пунктов
src/legal/coverage.ts        — collectCoveredRefs, computeCoverage
src/kiosk/useIdleReset.ts, KioskShell.tsx, SuspensionBanner.tsx, DemoRibbon.tsx
src/ui/Tile.tsx, ScreenLayout.tsx
src/external/ExternalLinkProvider.tsx, QrModal.tsx
src/screens/Home.tsx, Contacts.tsx, Documents.tsx, Rights.tsx, Doctors.tsx, DoctorCard.tsx
src/pdf/pdfjsAdapter.ts, PdfViewer.tsx, DocRoute.tsx
scripts/check-content.ts
deploy/nginx-kiosk.conf, deploy/README.md, deploy/kiosk-setup.md
tests/**                     — зеркалит src/
tests/helpers/renderApp.tsx  — рендер App с фейковым fetch по сиду
```

## Общие типы (определяются в Task 1, используются везде)

```ts
// src/data/schema.ts
type Weekday = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
type WeekHours = Record<Weekday, string | null>;        // "8:30–21:00" | null = выходной

interface Clinic {
  demo?: boolean;
  shortName: string;                 // «Стоматологический центр «Максима»»
  legalName: string;                 // п.1
  addresses: { address: string; hours: WeekHours }[];   // п.2, ≥1
  legalAddress: string;              // п.3
  ogrn: string; inn: string; kpp?: string;               // п.4, 5
  email: string; site: string;       // п.6, 7
  phones: { label: string; number: string }[];
  postalAddress: string;             // п.22
  chiefDoctor: { fullName: string; phone: string; receptionHours: string };  // п.23
  recordsRoomHours: string;          // п.23
  license: { number: string; date: string; issuer: string; validity: string; docId?: string }; // п.10
  suspension?: { active: boolean; from: string; to: string; text: string };  // п.27, ISO-даты YYYY-MM-DD
  gameUrl?: string;
  priceDocId?: string;               // id PDF прайса для плитки «Цены»
}

interface Credential { kind: string; series?: string; number?: string; issuedAt?: string;
  institution?: string; specialization?: string; validUntil?: string; uniqueNumber?: string }
interface Doctor { id: string; fullName: string; specialty: string; photo?: string;
  credentials: Credential[];                    // п.15 (диплом, постдипл., сертификат, ПК, аккредитация)
  schedule: Partial<Record<Weekday, string>> }  // п.16, "8:30–14:30 (1 смена)"

type DocItem =
  | { kind: 'pdf';    id: string; title: string; file: string; legalRefs: number[] }
  | { kind: 'link';   id: string; title: string; url: string;  legalRefs: number[] }
  | { kind: 'text';   id: string; title: string; body: string; legalRefs: number[] }
  | { kind: 'notice'; id: string; title: string; body: string; legalRefs: number[] };
interface DocSection { id: string; screen: 'documents'|'rights'; title: string; items: DocItem[] }

interface Authority { name: string; address: string; phone: string; site?: string }

interface KioskData { clinic: Clinic; doctors: Doctor[]; sections: DocSection[]; authorities: Authority[] }
```

Файлы: `clinic.json` → `Clinic`; `doctors.json` → `Doctor[]`; `documents.json` → `DocSection[]`; `authorities.json` → `Authority[]`.

---

### Task 1: Каркас, схемы данных, загрузка

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/theme/tokens.css`, `src/theme/global.css`, `src/data/schema.ts`, `src/data/load.ts`, `src/data/DataProvider.tsx`, `public/data/*.json`, `public/docs/sample.pdf`, `.claude/CLAUDE.md`, `.claude/rules/ARCHITECTURE.md`, `.gitignore`
- Test: `tests/data/load.test.ts`, `tests/data/DataProvider.test.tsx`, `tests/helpers/renderApp.tsx`, `tests/setup.ts`

**Interfaces:**
- Produces: типы из «Общих типов»; `loadKioskData(fetchImpl?: typeof fetch, base?: string): Promise<KioskData>`; `class DataError extends Error { file: string }`; `<DataProvider>` + `useKioskData(): KioskData`; `renderApp(opts?: { data?: Partial<KioskData>; route?: string; failFiles?: string[] })` в тестах — подменяет `global.fetch` фейком, отдающим сид из `public/data` с переопределениями.

- [ ] **Step 1: Инициализировать репо и зависимости.** `git init`, Vite react-ts шаблон в `~/maxima-kiosk`, зависимости из Tech Stack, Vitest (`environment: 'jsdom'`, `setupFiles: tests/setup.ts` с `@testing-library/jest-dom`). Скрипты: `dev`, `build`, `preview`, `test` (`vitest run`), `check-content` (`tsx scripts/check-content.ts`).
- [ ] **Step 2: Сид-данные.** `clinic.json` с `demo: true` и известными реальными полями: Смоленск, ул. Исаковского, д. 24; `+7 (4812) 33-99-33`; `ortos@339933.net`; `https://www.maxima-sm.ru`; ИНН `6730004954`, КПП `673101001`, ОГРН `1026701428160`; лицензия `Л041-01128-67/00295102` от `06.10.2014`; часы Пн–Пт `8:30–21:00`, Сб `9:00–18:00`, Вс выходной. Остальное (юр. наименование, юр. адрес, главврач, органы) — правдоподобные демо-значения. 2 демо-врача (у второго нет аккредитации и пустой четверг). `documents.json` — все секции из спеки, PDF-элементы указывают на `sample.pdf`, ссылки: `http://pravo.gov.ru/`, `https://cr.minzdrav.gov.ru/`, `https://e-stomatology.ru/`. Таблица юристов уже лежит в `docs/legal/requirements-stand.doc`.
- [ ] **Step 3: Написать падающие тесты `tests/data/load.test.ts`:**
  - `загружает и валидирует сид` → `loadKioskData(fakeFetch)` резолвится, `clinic.inn === '6730004954'`, `sections.length > 0`.
  - `сообщает, какой файл битый` → fakeFetch отдаёт `doctors.json` без `fullName` → rejects `DataError` с `file === 'doctors.json'`.
  - `сообщает о сетевой ошибке` → fetch для `clinic.json` rejects → `DataError` с `file === 'clinic.json'`.
- [ ] **Step 4: Запустить `npx vitest run tests/data/load.test.ts`** — FAIL (модуля нет).
- [ ] **Step 5: Реализовать `schema.ts` (zod, типы через `z.infer`) и `load.ts`** — 4 файла параллельно через `Promise.all`, `cache: 'no-cache'`.
- [ ] **Step 6: Тесты PASS.**
- [ ] **Step 7: Падающие тесты `tests/data/DataProvider.test.tsx`:**
  - `при ошибке показывает экран недоступности` → `renderApp({ failFiles: ['clinic.json'] })` → текст `Информация временно недоступна`.
  - `повторяет загрузку каждые 30 секунд` → fake timers; после восстановления fetch и `advanceTimersByTime(30_000)` → виден текст `Добро пожаловать`.
- [ ] **Step 8: Реализовать `DataProvider`** (состояния loading / error / ready, ретрай `30_000` мс) и минимальный `App` с заголовком `Добро пожаловать` на `/`. Тесты PASS.
- [ ] **Step 9: Проектная документация.** `.claude/CLAUDE.md` (команды `npm run dev|test|build|check-content`, правила: данные только в JSON, внешние ссылки только QR, TDD, коммиты — короткое русское описание без номера); `.claude/rules/ARCHITECTURE.md` по контракту (стек, команды, дерево, индекс модулей, `### Базовый образ` → «Отсутствует — проект не использует пред-собранный base image для кэша зависимостей.»).
- [ ] **Step 10: Commit** — `Каркас киоска: схемы данных и загрузка` (включает спеку и план).

### Task 2: Юридические пункты и проверка полноты

**Files:**
- Create: `src/legal/requirements.ts`, `src/legal/coverage.ts`, `scripts/check-content.ts`
- Test: `tests/legal/coverage.test.ts`

**Interfaces:**
- Consumes: `KioskData`, схемы из Task 1.
- Produces: `REQUIREMENTS: { n: number; title: string; stand: boolean; conditional?: boolean }[]` (28 записей); `collectCoveredRefs(data: KioskData): Set<number>`; `computeCoverage(data: KioskData, existingFiles: Set<string>): { n: number; title: string; status: 'covered'|'missing'|'n/a'|'conditional' }[]`.

Правила покрытия (`collectCoveredRefs`): `legalRefs` всех `DocItem`; из `clinic`: 1 legalName, 2 addresses≥1, 3 legalAddress, 4 ogrn, 5 inn, 6 email, 7 site, 22 postalAddress, 23 chiefDoctor+recordsRoomHours, 10 license.number+date+issuer **и** pdf-элемент с ref 10; 15 — каждый врач имеет ≥1 credential; 16 — каждый врач имеет ≥1 день в schedule; 24 — authorities ≥ 3. `stand: false` только у п. 26 → `n/a`; п. 27 → `conditional`. PDF-элемент, чей `file` отсутствует в `existingFiles`, ничего не покрывает.

- [ ] **Step 1: Падающие тесты:**
  - `сид покрывает все пункты стенда` → в `computeCoverage(seed, allFiles)` нет `missing`.
  - `пункт 26 неприменим к стенду` → status `n/a`.
  - `отсутствующий PDF раскрывает дыру` → убрать файл выписки из `existingFiles` → п. 9 `missing`.
  - `врач без квалификации раскрывает п.15` → у одного врача `credentials: []` → п. 15 `missing`.
- [ ] **Step 2: Запустить — FAIL.**
- [ ] **Step 3: Реализовать `requirements.ts`** (заголовки — сокращённые формулировки из `docs/legal/requirements-stand.doc`) и `coverage.ts`.
- [ ] **Step 4: Тесты PASS.**
- [ ] **Step 5: `scripts/check-content.ts`** — читает `public/data/*.json` через fs, валидирует схемами, собирает `existingFiles` из `public/docs`, печатает таблицу `№ | пункт | статус`, при `clinic.demo` печатает предупреждение; exit 1 при невалидном JSON или любом `missing`. Проверка: `npm run check-content` → таблица, exit 0 на сиде.
- [ ] **Step 6: Commit** — `Проверка полноты юридических пунктов`.

### Task 3: Киоск-оболочка — раскладка, баннер, демо-лента, защита ввода

**Files:**
- Create: `src/kiosk/KioskShell.tsx`, `src/kiosk/SuspensionBanner.tsx`, `src/kiosk/DemoRibbon.tsx`, `src/ui/ScreenLayout.tsx`, `src/ui/Tile.tsx`
- Modify: `src/App.tsx`, `src/theme/global.css`, `index.html`
- Test: `tests/kiosk/shell.test.tsx`

**Interfaces:**
- Produces: `<ScreenLayout title: string; children>` — шапка с кнопками `← Назад` (history back) и `Главная` (на `/`), на главной без них; `<Tile to?: string; onPress?: () => void; icon?: ReactNode; accent?: boolean; children>`; `isSuspensionVisible(s: Clinic['suspension'], today: string): boolean`.

- [ ] **Step 1: Падающие тесты:**
  - `баннер приостановки виден в период` → suspension `{active:true, from:'2026-11-10', to:'2026-11-20', text:'Санобработка'}`, system time 2026-11-16 → текст `Санобработка` на `/` и на `/documents`.
  - `баннер скрыт после окончания срока` → system time 2026-11-21 → текста нет.
  - `баннер скрыт если active=false`.
  - `демо-лента видна при demo=true и скрыта при false` → текст `ДЕМО-ДАННЫЕ`.
  - `кнопка Главная возвращает на /` → `renderApp({route:'/documents'})`, клик `Главная` → `Добро пожаловать`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Реализовать.** «Сегодня» — дата в `Europe/Moscow` через `Intl.DateTimeFormat('sv-SE', {timeZone})`. Защита ввода в `global.css`/`KioskShell`: `user-select:none`, `-webkit-touch-callout:none`, `touch-action: pan-x pan-y` на body, `overscroll-behavior:none`, `contextmenu` → `preventDefault`; viewport `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — `Киоск-оболочка: раскладка, баннер приостановки`.

### Task 4: Главная и Контакты

**Files:**
- Create: `src/screens/Home.tsx`, `src/screens/Contacts.tsx`
- Modify: `src/App.tsx`
- Test: `tests/screens/home.test.tsx`

**Interfaces:**
- Consumes: `Tile`, `ScreenLayout`, `useKioskData`, `ExternalLink` (Task 5 — в Contacts сайт пока выводится текстом; Task 5 заменит на `ExternalLink`).
- Produces: маршруты `/`, `/contacts`; плитки ведут на `/documents`, `/doctors`, `/doc/:priceDocId`, `/rights`, `/contacts`.

- [ ] **Step 1: Падающие тесты:**
  - `показывает режим работы на сегодня` → system time пятница 2026-11-20 12:00 МСК → `Сегодня: 8:30–21:00`.
  - `воскресенье — выходной` → 2026-11-22 → `Сегодня выходной`.
  - `плитка игры скрыта без gameUrl` → нет текста `Игра для детей`.
  - `плитка игры ведёт на gameUrl` → `gameUrl:'https://zub.example.ru/'`, `window.location.assign` подменён `vi.fn` → клик → вызван с этим URL.
  - `плитка Цены открывает прайс` → клик `Цены` → маршрут `/doc/<priceDocId>`.
  - `Контакты показывают адрес и телефоны` → `/contacts` → `ул. Исаковского`, `33-99-33`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Реализовать.** Плитки: «Документы и сведения», «Врачи и расписание», «Цены», «Права пациента и обращения», «Контакты», «Игра для детей» (`accent`). Сетка адаптивная: портрет 2 колонки, ландшафт 3. Логотип — текстовый вордмарк `src/ui/Logo.tsx` («МАКСИМА» + 3 цветные точки) до получения исходника от клиники.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — `Главная и контакты`.

### Task 5: Внешние ссылки как QR + сброс по простою

**Files:**
- Create: `src/external/ExternalLinkProvider.tsx`, `src/external/QrModal.tsx`, `src/kiosk/useIdleReset.ts`
- Modify: `src/App.tsx`, `src/screens/Contacts.tsx`
- Test: `tests/external/qr.test.tsx`, `tests/kiosk/idle.test.tsx`

**Interfaces:**
- Produces: `useExternalLink(): { open(url: string, title: string): void; close(): void }`; `<ExternalLink url title>` — кнопка, вызывающая `open`; `useIdleReset(timeoutMs: number, onIdle: () => void): void` (слушает `pointerdown`, `touchstart`, `keydown`, `wheel` на `window`).

- [ ] **Step 1: Падающие тесты:**
  - `внешняя ссылка открывает QR, а не переход` → на `/contacts` клик по сайту → диалог с текстом `maxima-sm.ru`, `Наведите камеру телефона` и `<canvas>`/`<img>` QR; `window.location.assign` не вызван.
  - `QR закрывается кнопкой Закрыть`.
  - `простой 90 с возвращает на главную` → `/documents`, `advanceTimersByTime(90_000)` → `Добро пожаловать`.
  - `касание сбрасывает таймер` → 60 с, `pointerdown`, ещё 60 с → всё ещё на `/documents`.
  - `простой закрывает открытый QR` → открыть QR, 90 с → диалога нет, главная.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Реализовать.** QR — `qrcode.toDataURL(url, { width: 480, margin: 1 })` в `<img alt="QR-код">`. `onIdle` в App: `close()` + `navigate('/')`.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — `Внешние ссылки через QR, сброс по простою`.

### Task 6: Документы и Права пациента

**Files:**
- Create: `src/screens/Documents.tsx`, `src/screens/Rights.tsx`, `src/screens/DocItemView.tsx`
- Modify: `src/App.tsx`
- Test: `tests/screens/documents.test.tsx`

**Interfaces:**
- Consumes: `DocSection`, `useExternalLink`, `ScreenLayout`.
- Produces: маршруты `/documents`, `/rights`; `<DocItemView item: DocItem>` — `pdf` → кнопка на `/doc/:id`, `link` → `ExternalLink`, `text`/`notice` → заголовок + текст (notice с иконкой ℹ).

- [ ] **Step 1: Падающие тесты:**
  - `документы показывают только секции screen=documents` → заголовки секций сида с `documents` есть, секции `rights` нет.
  - `pdf-элемент ведёт в просмотрщик` → клик `Выписка из ЕГРЮЛ` → маршрут `/doc/egrul`.
  - `ссылка на правовой портал открывает QR` → клик `pravo.gov.ru`-элемента → QR-диалог.
  - `права пациента показывают главврача, почтовый адрес и органы` → `/rights` → ФИО главврача, его телефон, `recordsRoomHours`, `postalAddress`, все `authorities[].name`.
  - `книга жалоб — как уведомление` → текст `у администратора`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Реализовать.** Секции — крупные карточки-аккордеоны не нужны: заголовок секции + список крупных строк.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — `Экраны документов и прав пациента`.

### Task 7: Врачи и расписание

**Files:**
- Create: `src/screens/Doctors.tsx`, `src/screens/DoctorCard.tsx`
- Modify: `src/App.tsx`
- Test: `tests/screens/doctors.test.tsx`

**Interfaces:**
- Produces: маршруты `/doctors`, `/doctors/:id`.

- [ ] **Step 1: Падающие тесты:**
  - `список врачей с ФИО и специальностью` → оба демо-врача.
  - `карточка показывает квалификацию таблицей` → клик врача → для каждого credential строка с `kind`, `number`, `institution`.
  - `карточка показывает график по дням` → `Пн`, его время.
  - `частичные данные не дают пустых строк` → второй врач: нет строки `Аккредитация`, нет строки `Чт`, в DOM нет `undefined`.
  - `неизвестный id → назад к списку` → `/doctors/nope` → список врачей.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Реализовать.** Список — сетка карточек с фото (если есть), иначе инициалы в круге акцентного цвета.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — `Врачи и расписание`.

### Task 8: Просмотрщик PDF

**Files:**
- Create: `src/pdf/pdfjsAdapter.ts`, `src/pdf/PdfViewer.tsx`, `src/pdf/DocRoute.tsx`
- Modify: `src/App.tsx`
- Test: `tests/pdf/viewer.test.tsx`

**Interfaces:**
- Produces: `interface PdfDoc { numPages: number; renderPage(n: number, canvas: HTMLCanvasElement, scale: number): Promise<void> }`; `openPdf(url: string): Promise<PdfDoc>` (адаптер pdfjs-dist, worker через `?url` импорт); `<PdfViewer url: string; title: string; open?: (url: string) => Promise<PdfDoc>>` (`open` по умолчанию — `openPdf`); маршрут `/doc/:id` — ищет pdf-элемент по `id` во всех секциях, неизвестный id → `/documents`.

- [ ] **Step 1: Падающие тесты** (фейковый `open`, возвращающий `PdfDoc` на 3 страницы):
  - `показывает номер страницы` → `1 / 3`.
  - `кнопка Далее листает` → `2 / 3`; на последней `Далее` disabled.
  - `свайп влево листает вперёд` → pointerdown x=600 → pointerup x=200 → `2 / 3`.
  - `зум кнопками в пределах 1–3` → `+` ×5 → индикатор `300%`; `−` ниже `100%` не уходит.
  - `ошибка загрузки` → `open` rejects → `Документ временно недоступен` и кнопка `Назад`.
  - `неизвестный документ` → `/doc/nope` → экран документов.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Реализовать.** Шаг зума 0.5, порог свайпа 80 px; при zoom > 1 свайп не листает (панорамирование скроллом контейнера, `touch-action: pan-x pan-y` на нём).
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Ручная проверка:** `npm run dev`, открыть `/#/doc/egrul` — `sample.pdf` рендерится.
- [ ] **Step 6: Commit** — `Просмотрщик PDF`.

### Task 9: Офлайн-кэш и проверка вёрстки

**Files:**
- Modify: `vite.config.ts`, `src/main.tsx`
- Test: ручная проверка

- [ ] **Step 1: Подключить `vite-plugin-pwa`:** `registerType: 'autoUpdate'`, `workbox.globPatterns: ['**/*.{js,css,html,woff2,svg,png}']`, `runtimeCaching`: `/data/*.json` → `NetworkFirst` (`networkTimeoutSeconds: 3`), `/docs/*.pdf` → `StaleWhileRevalidate`. Без web-manifest-иконок установки (не нужен install prompt): `manifest: false`.
- [ ] **Step 2: `npm run build && npm run preview`** → в `dist/` есть `sw.js`; в браузере после первой загрузки DevTools → Offline → перезагрузка → главная и уже открытый PDF доступны.
- [ ] **Step 3: Проверка вёрстки** в built-in browser на 1080×1920 и 1920×1080: на каждом экране нет горизонтального скролла, плитки ≥ 72 px, длинное юр. наименование переносится (`overflow-wrap:anywhere`). Скриншоты обоих размеров главной — владельцу.
- [ ] **Step 4: `npm test` и `npm run check-content`** — всё зелёное.
- [ ] **Step 5: Commit** — `Офлайн-кэш`.

### Task 10: Артефакты деплоя (без выкладки)

**Files:**
- Create: `deploy/nginx-kiosk.conf`, `deploy/README.md`, `deploy/kiosk-setup.md`

- [ ] **Step 1: `nginx-kiosk.conf`:** `server_name kiosk.339933.net; root /opt/maxima-kiosk/dist;` `location = /sw.js` и `location /data/` → `Cache-Control: no-cache`; `/assets/` → `max-age=31536000, immutable`; `add_header X-Robots-Tag "noindex"`; `try_files $uri /index.html`.
- [ ] **Step 2: `deploy/README.md`** (runbook): A-запись `kiosk` → `80.78.253.231` в DNS Reg.ru (зона `339933.net`); `npm run check-content && npm run build`; `rsync -az --delete dist/ root@80.78.253.231:/opt/maxima-kiosk/dist/` (ключ `~/.ssh/id_ed25519`); симлинк конфига в `sites-enabled`, `nginx -t && systemctl reload nginx`; `certbot --nginx -d kiosk.339933.net`. Как обновить документ: положить PDF в `public/docs/`, поправить JSON, `check-content`, build, rsync.
- [ ] **Step 3: `deploy/kiosk-setup.md` (Windows):** ярлык в `shell:startup` (или Планировщик заданий при входе) на `chrome.exe` `--kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 --disable-features=TranslateUI https://kiosk.339933.net/`, постоянный профиль, автозагрузка; про `gameUrl` — включать только после доработки игры (возврат на стенд) и ввода пароля на киоске.
- [ ] **Step 4: Commit** — `Конфиги и инструкции деплоя`.

Выкладка на VPS и DNS — отдельным шагом только с явного «да» владельца.
