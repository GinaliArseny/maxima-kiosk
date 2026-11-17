# Админка киоска — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Админ клиники сам правит врачей, документы, прайс, сведения о клинике, надзорные органы и настройки заставки через `https://kiosk-admin.339933.net`; сохранение сразу публикует, киоск подхватывает за 1–3 минуты.

**Architecture:** Данные киоска переезжают из сборки в `/opt/maxima-kiosk/content/{data,docs,doctors}`; `dist/data|docs|doctors` на сервере — симлинки туда, выкладка их не трогает. Сервер админки (Fastify, Docker, `127.0.0.1:<порт>` за nginx) читает/пишет эти файлы через `ContentStore`: проверка общей zod-схемой + межфайловые связи, атомарная запись, снимок в историю, `version.json`. Веб-админка — React SPA, отдаётся тем же сервером. Сайт киоска раз в минуту смотрит `data/version.json` и перезагружается в простое.

**Tech Stack:** существующие React 18.3 / TS 5.6 / Vite 5.4 / zod 3.23 / Vitest 2.1; сервер — Node 22, Fastify 5 (+ `@fastify/cookie`, `@fastify/multipart`, `@fastify/static`, `@fastify/rate-limit`), `bcryptjs`, `sharp`; сборка сервера — esbuild; Docker (`node:22-slim`).

**Spec:** `docs/superpowers/specs/2026-11-17-kiosk-app-admin-design.md` (часть «3. Админка» + «Хранение данных»; заставка — только файл `screensaver.json`, сама заставка — план `2026-11-17-kiosk-app.md`).

## Global Constraints

- Репо `~/maxima-kiosk`, ветка `kiosk-v1`. Коммиты — короткое русское описание, без номеров задач и без упоминаний AI.
- Вся проверка данных — **одна** схема `src/data/schema.ts` для сайта, админки и `check-content`; не дублировать.
- Сохранение = публикация. Никаких черновиков и ролей утверждения.
- Невалидные данные не пишутся на диск ни при каких условиях; запись атомарная (tmp + `rename` в том же каталоге).
- Ключи/пароли Jellyfin в `screensaver.json` не попадают (файл публичный).
- PDF до 30 МБ и начинается с `%PDF`; фото до 10 МБ, jpg/png → webp ширина 600 px.
- Пароли — bcrypt; сессия — httpOnly + Secure + SameSite=Strict cookie, 12 ч; вход — не больше 5 попыток в минуту с IP.
- Тексты ошибок для админа — по-русски, привязаны к полю.
- Тесты в стиле существующих: поведенческие, русские названия, моки только на границах (сеть браузера — fake fetch; файловую систему сервера НЕ мокать — временный каталог).
- `admin` и выкладка: VPS `80.78.253.231`, `ssh -i ~/.ssh/id_ed25519 root@80.78.253.231`; на хосте нет Node — только Docker.

## Review Focus

1. Выкладка сайта после запуска админки — `rsync dist/` не должен затереть `content/`, даже если в `dist/` по ошибке окажется `data/`. Тест: Task 1 (сборка без `data|docs|doctors`) + `--exclude` в README и проверка в Task 9.
2. Админ удаляет документ-прайс, на который ссылается `clinic.priceDocId`, или PDF-элемент без файла — киоск не должен остаться с битой ссылкой. Тест: Task 3 «удаление элемента прайса отклоняется».
3. Два окна админки одновременно — второе сохранение не затирает первое молча. Тест: Task 3 «конфликт версий».
4. Загрузка не-PDF под видом PDF / огромного файла. Тест: Task 4.
5. `version.json` отсутствует или сеть упала — киоск не перезагружается в цикле и не ломается. Тест: Task 2.

---

### Task 1: Данные вне сборки + схема: `hidden` у врача, `screensaver.json`

**Files:**
- Modify: `src/data/schema.ts` — `doctorSchema.hidden`, `screensaverSchema`, `EDITABLE_FILES`
- Modify: `src/screens/Doctors.tsx`, `src/screens/DoctorCard.tsx` — скрытые врачи не показываются
- Create: `public/data/screensaver.json` — `{"enabled": false, "idleMinutes": 3, "muted": true, "sources": []}`
- Modify: `vite.config.ts` — плагин `closeBundle` удаляет `dist/data`, `dist/docs`, `dist/doctors`; runtime-кэш `/doctors/*.webp` (StaleWhileRevalidate, `kiosk-photos`); vite dev по-прежнему отдаёт их из `public/`
- Modify: `scripts/check-content.ts` — проверяет и `screensaver.json`
- Test: `tests/screens/doctors.test.tsx`, `tests/data/schema.test.ts` (new), `tests/build/dist.test.ts` (new)

**Interfaces:**
- Produces:
  - `doctorSchema` + `hidden: z.boolean().optional()`
  - `screensaverSchema = z.object({ enabled: z.boolean(), idleMinutes: z.number().int().min(1).max(60), muted: z.boolean(), sources: z.array(z.object({ itemId: z.string().regex(/^[0-9a-f]{32}$/), label: nonEmpty.optional() })) })`, `type Screensaver`
  - `EDITABLE_FILES = { ...fileSchemas, 'screensaver.json': screensaverSchema } as const`, `type EditableFile = keyof typeof EDITABLE_FILES`
  - `fileSchemas` (то, что грузит киоск) — без изменений состава.

- [ ] **Step 1: Тесты**
  - `doctors.test.tsx`: `it('врач с hidden: true не показывается ни в списке, ни по прямой ссылке')` — `renderApp({ doctors: [видимый, {…, id: 'skryt', hidden: true}] })`; список не содержит ФИО скрытого; `route: '/doctors/skryt'` → экран «Врач не найден» (как для несуществующего id).
  - `schema.test.ts`: `screensaverSchema` принимает `public/data/screensaver.json`; отклоняет `idleMinutes: 0`, `itemId: 'abc'`; в `EDITABLE_FILES` 5 ключей.
  - `dist.test.ts` (запускается после `npm run build`, пропускается через `it.skipIf(!existsSync('dist'))`): `dist/index.html` есть; `dist/data`, `dist/docs`, `dist/doctors` нет.
- [ ] **Step 2:** `npx vitest run tests/screens/doctors.test.tsx tests/data/schema.test.ts` → FAIL.
- [ ] **Step 3:** Реализовать схему, фильтр `hidden` (в одном месте — там, где экраны берут врачей), плагин в `vite.config.ts`, runtime-кэш фото, проверку в `check-content`.
- [ ] **Step 4:** `npm test && npm run build && npx vitest run tests/build/dist.test.ts` → всё PASS; `ls dist` без `data docs doctors`.
- [ ] **Step 5:** Коммит `Данные киоска вне сборки; скрытые врачи; схема заставки`.

### Task 2: Киоск подхватывает изменения за минуту

**Files:**
- Create: `src/kiosk/useContentVersion.ts`
- Modify: `src/kiosk/IdleReset.tsx`
- Test: `tests/kiosk/reload.test.tsx`

**Interfaces:**
- Produces: `VERSION_POLL_MS = 60_000`; `useContentVersion(fetchImpl?: typeof fetch, url = './data/version.json'): () => boolean` — возвращает функцию «версия изменилась с момента загрузки страницы». `version.json` = `{ "version": string }`.
- `IdleReset` при срабатывании простоя перезагружает, если `isStale() || возраст ≥ RELOAD_AFTER_MS`.

- [ ] **Step 1: Тесты** (в `reload.test.tsx`, фейковые таймеры, fetch подменён по образцу `makeFakeFetch`):
  - `it('сохранение в админке: версия сменилась → перезагрузка в ближайший простой, а не через 30 минут')` — версия `a`, через 60 с — `b`; после 90 с простоя `reload` вызван 1 раз, при этом прошло < 5 мин.
  - `it('пока посетитель работает, смена версии не перезагружает')`.
  - `it('version.json нет (404) или сеть упала — перезагрузки нет, работает 30-минутный запасной таймер')`.
  - `it('первая удачная версия после сбоя сети не считается изменением')`.
- [ ] **Step 2:** `npx vitest run tests/kiosk/reload.test.tsx` → FAIL.
- [ ] **Step 3:** Реализовать хук (первый удачный ответ — эталон; дальше сравнение; ошибки игнорируются) и использовать в `IdleReset`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Коммит `Киоск перезагружается при смене версии данных`.

### Task 3: `ContentStore` — чтение, проверка, атомарная запись, история

**Files:**
- Create: `admin/server/contentStore.ts`, `admin/server/validate.ts`
- Modify: `package.json` — devDeps `fastify @fastify/cookie @fastify/multipart @fastify/static @fastify/rate-limit bcryptjs sharp esbuild` (+ типы), скрипт `"admin:test": "vitest run tests/admin"`
- Modify: `vite.config.ts` → в `test` для `tests/admin/**` окружение `node` (`environmentMatchGlobs`)
- Test: `tests/admin/contentStore.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Issue = { path: string; message: string };           // path вида 'doctors.3.fullName'
  class ValidationError extends Error { issues: Issue[] }
  class ConflictError extends Error {}
  interface HistoryEntry { id: string; at: string; user: string; file: EditableFile }
  class ContentStore {
    constructor(root: string, opts?: { historyLimit?: number; now?: () => Date }) // root содержит data/ docs/ doctors/ history/
    read(file: EditableFile): Promise<{ data: unknown; version: string }>       // version = первые 12 hex sha256 содержимого
    save(file: EditableFile, data: unknown, baseVersion: string, user: string): Promise<{ version: string }>
    history(): Promise<HistoryEntry[]>                                        // новые сверху
    restore(id: string, user: string): Promise<void>
    coverage(): Promise<CoverageRow[]>                                        // computeCoverage по текущим файлам и docs/
  }
  function validateAll(files: Record<EditableFile, unknown>, existing: { docs: Set<string>; photos: Set<string> }): Issue[]
  ```
- `validateAll`: zod по `EDITABLE_FILES` + связи: каждый `pdf.file` есть в `docs/`; `clinic.priceDocId` и `clinic.license.docId` указывают на существующий элемент; `doctor.photo` есть в `doctors/`; `id` уникальны внутри врачей и внутри всех элементов документов. Сообщения — по-русски.
- `save`: base ≠ текущая → `ConflictError`; иначе проверка всего набора с заменённым файлом → `ValidationError`; запись `<file>.tmp` + `rename`; снимок `history/<id>.json` = `{ at, user, file, files: {все 5 JSON} }`; `data/version.json` = `{ version: <новый id> }`; хранить последние `historyLimit` (по умолчанию 500) снимков.
- `restore`: проверка снимка тем же `validateAll` (файлы могли исчезнуть) → запись всех файлов → новая запись истории.

- [ ] **Step 1: Тесты** (реальный временный каталог, засеянный копией `public/data`, `public/docs`, `public/doctors`):
  - `it('сохранение валидных врачей видно при следующем чтении и меняет version.json')`
  - `it('невалидные данные отклоняются с путём и русским сообщением, файл на диске не меняется')` — пустое `fullName`.
  - `it('конфликт версий: сохранение со старой версией отклоняется')`
  - `it('удаление элемента прайса, на который ссылается clinic.priceDocId, отклоняется')`
  - `it('PDF-элемент с файлом, которого нет в docs/, отклоняется')`
  - `it('каждое сохранение попадает в историю: кто, когда, какой файл; откат возвращает прежние данные и тоже пишется в историю')`
  - `it('история не растёт больше лимита')` — `historyLimit: 3`, 5 сохранений → 3 записи.
  - `it('покрытие: по сид-данным открыты те же пункты, что показывает check-content')` — 10, 16, 17, 21, 22, 23, 24 `missing`.
- [ ] **Step 2:** `npx vitest run tests/admin/contentStore.test.ts` → FAIL.
- [ ] **Step 3:** Реализовать.
- [ ] **Step 4:** тот же запуск → PASS; `npm test` → PASS.
- [ ] **Step 5:** Коммит `Админка: хранилище контента с проверкой и историей`.

### Task 4: Загрузка PDF и фото

**Files:**
- Create: `admin/server/uploads.ts`
- Test: `tests/admin/uploads.test.ts`

**Interfaces:**
- Produces: `savePdf(root: string, buf: Buffer, hint: string, now?: Date): Promise<string>` → имя файла в `docs/` вида `<slug(hint)>-<YYYY-MM-DD>-<6 hex>.pdf`; `savePhoto(root: string, buf: Buffer, hint: string): Promise<string>` → `doctors/<slug>-<6 hex>.webp`. Ошибки — `ValidationError` с `path: 'file'`. Старые файлы не удаляются.
- `slug` — транслит кириллицы + kebab-case, латиница/цифры/дефис.

- [ ] **Step 1: Тесты:** `it('PDF сохраняется под новым уникальным именем, старый прайс остаётся')`; `it('файл не PDF (без %PDF в начале) отклоняется')`; `it('PDF больше 30 МБ отклоняется')`; `it('фото jpg превращается в webp шириной не больше 600 px')` (проверка через `sharp(...).metadata()`); `it('битая картинка отклоняется понятной ошибкой')`.
- [ ] **Step 2:** запуск → FAIL. **Step 3:** реализовать. **Step 4:** → PASS.
- [ ] **Step 5:** Коммит `Админка: загрузка PDF и фото`.

### Task 5: HTTP-сервер: вход, API контента, загрузки, история

**Files:**
- Create: `admin/server/app.ts` (сборка Fastify), `admin/server/auth.ts`, `admin/server/main.ts` (чтение env, запуск), `admin/server/userCli.ts`
- Test: `tests/admin/api.test.ts` (через `app.inject`)

**Interfaces:**
- Consumes: `ContentStore`, `savePdf`, `savePhoto`.
- Produces: `buildApp(opts: { contentRoot: string; usersFile: string; webDir?: string; secure?: boolean }): FastifyInstance`.
- Пользователи: `usersFile` = `[{ login, hash }]`; `npm run admin:user -- <login>` спрашивает пароль дважды и добавляет/меняет.
- API (все, кроме входа, требуют сессию, иначе 401):
  - `POST /api/login {login,password}` → 204 + cookie `ka_sid` | 401 `{error:'Неверный логин или пароль'}`; лимит 5/мин/IP → 429.
  - `POST /api/logout` → 204. `GET /api/me` → `{login}`.
  - `GET /api/content/:file` → `{data, version}`; неизвестный файл → 404.
  - `PUT /api/content/:file {data, baseVersion}` → 200 `{version}` | 409 `{error:'Данные изменились — обновите страницу'}` | 422 `{issues}`.
  - `POST /api/upload/pdf` и `/api/upload/photo` (multipart, поле `file`, поле `hint`) → `{file}` | 422 `{issues}`; лимит тела 31 МБ.
  - `GET /api/history`; `POST /api/history/:id/restore` → 204 | 422.
  - `GET /api/coverage` → `CoverageRow[]`.
  - Статика `webDir` с fallback на `index.html`; заголовок `X-Robots-Tag: noindex, nofollow` на всём.
- Env для `main.ts`: `CONTENT_ROOT=/content`, `USERS_FILE=/admin-data/users.json`, `PORT`, `HOST=0.0.0.0`; сессии в памяти (рестарт = перелогин — допустимо).

- [ ] **Step 1: Тесты:** `it('без входа API отвечает 401')`; `it('вход с верным паролем открывает доступ, с неверным — 401 с русским текстом')`; `it('шестая попытка входа за минуту — 429')`; `it('PUT невалидных данных → 422 с issues, валидных → 200 и новая версия')`; `it('PUT со старой версией → 409')`; `it('загрузка PDF возвращает имя файла, и его можно сослаться в documents.json')`; `it('cookie сессии httpOnly и SameSite=Strict')`.
- [ ] **Step 2:** → FAIL. **Step 3:** реализовать. **Step 4:** → PASS.
- [ ] **Step 5:** Коммит `Админка: HTTP API с входом`.

### Task 6: Веб-админка: каркас, вход, главная с требованиями, клиника, надзорные органы

**Files:**
- Create: `admin/web/index.html`, `admin/web/vite.config.ts` (root `admin/web`, outDir `admin/web/dist`, dev-прокси `/api` → `localhost:8787`), `admin/web/src/main.tsx`, `App.tsx`, `api.ts`, `ui/` (поле, кнопка, список ошибок — свои CSS-модули на токенах `src/theme/tokens.css`), `pages/Login.tsx`, `pages/Dashboard.tsx`, `pages/ClinicForm.tsx`, `pages/AuthoritiesForm.tsx`
- Modify: `package.json` — `"admin:web": "vite --config admin/web/vite.config.ts"`, `"admin:build": "vite build --config admin/web/vite.config.ts && node admin/build-server.mjs"`
- Create: `admin/build-server.mjs` (esbuild: `admin/server/main.ts` → `admin/server/dist/main.mjs`, `platform: node`, `external: ['sharp']`)
- Test: `tests/admin/web/*.test.tsx` (jsdom; fetch подменён фейковым API)

**Interfaces:**
- Produces: `api.ts`: `getContent<T>(file): Promise<{data:T; version:string}>`, `putContent(file, data, baseVersion): Promise<{version:string}>` — бросает `ApiValidationError{issues}` / `ApiConflictError`; `upload(kind: 'pdf'|'photo', file: File, hint: string): Promise<string>`; `login`, `logout`, `me`, `history`, `restore`, `coverage`.
- Общий паттерн формы: загрузка → редактирование → «Сохранить» → успех «Опубликовано, на киоске через 1–3 минуты» | ошибки у полей (по `issue.path`) | конфликт — баннер «Данные изменились — обновите страницу». Несохранённые изменения → предупреждение при уходе со страницы.
- Меню: Главная · Врачи · Документы · Цены · Клиника · Надзорные органы · Заставка · История · Выйти.
- Dashboard: «Закрыто N из 26 пунктов стенда» (п. 26 неприменим, п. 27 — по событию) + список `missing` словами из `REQUIREMENTS.title`.
- ClinicForm: все поля `clinicSchema` кроме `demo`; часы — 7 строк «день: часы / выходной»; приостановка — переключатель + даты + текст; `priceDocId` и `license.docId` — выпадающие списки из элементов `documents.json`.

- [ ] **Step 1: Тесты:** `it('без сессии показывается вход; после входа — главная с числом закрытых пунктов и списком незакрытых')`; `it('клиника: ошибка проверки показывается у поля телефона')`; `it('клиника: конфликт версий показывает баннер «обновите страницу»')`; `it('успешное сохранение говорит, когда изменения появятся на киоске')`.
- [ ] **Step 2:** → FAIL. **Step 3:** реализовать. **Step 4:** → PASS; `npm run admin:build` без ошибок.
- [ ] **Step 5:** Коммит `Админка: вход, главная, клиника, надзорные органы`.

### Task 7: Веб-админка: врачи, документы, цены

**Files:**
- Create: `admin/web/src/pages/Doctors.tsx`, `DoctorForm.tsx`, `Documents.tsx`, `DocItemForm.tsx`, `Prices.tsx`, `admin/web/src/legalRefs.ts`
- Test: `tests/admin/web/doctors.test.tsx`, `documents.test.tsx`, `prices.test.tsx`

**Interfaces:**
- Consumes: `api.ts`, `REQUIREMENTS`.
- Врачи: список с порядком (кнопки ↑/↓), «скрыть/показать», «удалить» (с подтверждением), «добавить». Форма: ФИО, специальность, фото (загрузка → `upload('photo')`), квалификация — список строк `{kind, details}` (добавить/удалить/порядок), график — 7 полей по дням. `id` нового врача — slug ФИО (уникализируется суффиксом).
- Документы: 5 разделов фиксированы (добавлять/удалять разделы нельзя); в разделе — элементы с порядком, добавить/изменить/удалить. Форма элемента: вид (PDF / ссылка / текст / объявление), название, PDF-файл (загрузка) | URL | текст, «Закрывает пункты требований» — чекбоксы по `REQUIREMENTS` где `stand && !conditional`. `id` нового — slug названия.
- Цены: показывает текущий прайс (название + дата файла), «Загрузить новый прайс» → `upload('pdf', …, 'prices')` → в `documents.json` у элемента `clinic.priceDocId` меняется `file` → `putContent`. Если прайса ещё нет — создаётся элемент `{kind:'pdf', id:'prices', title:'Прейскурант на платные медицинские услуги', legalRefs:[11]}` в разделе «Услуги» и `clinic.priceDocId = 'prices'` (два сохранения, сначала документы).

- [ ] **Step 1: Тесты:** `it('скрытие врача сохраняет hidden: true')`; `it('новый врач с фото: фото загружается, врач появляется в списке после сохранения')`; `it('порядок врачей меняется кнопками и сохраняется')`; `it('замена PDF документа сохраняет новое имя файла')`; `it('новый элемент со ссылкой без https:// показывает ошибку у поля URL')`; `it('загрузка нового прайса меняет файл у элемента прайса')`.
- [ ] **Step 2:** → FAIL. **Step 3:** реализовать. **Step 4:** → PASS.
- [ ] **Step 5:** Коммит `Админка: врачи, документы, цены`.

### Task 8: Веб-админка: заставка и история

**Files:**
- Create: `src/data/jellyfin.ts`, `admin/web/src/pages/Screensaver.tsx`, `admin/web/src/pages/History.tsx` (подсказка про ссылку — текстом; скриншот добавляется отдельно, когда владелец его пришлёт)
- Test: `tests/data/jellyfin.test.ts`, `tests/admin/web/screensaver.test.tsx`, `tests/admin/web/history.test.tsx`

**Interfaces:**
- Produces: `parseJellyfinLink(input: string): string | null` — ID из `…/web/#/details?id=<32hex>&…`, `…/Items/<32hex>/Download?…`, `…/Items/<32hex>…`, или голый 32-hex; иначе `null`. Всё остальное из ссылки (хост, `ApiKey`) отбрасывается.
- Screensaver: переключатель «Включена», «Через сколько минут простоя» (1–60), «Со звуком», список источников (вставить ссылку → `parseJellyfinLink` → `{itemId, label?}`; порядок; удалить). Подсказка «Как достать ссылку» — текст из спеки (открыть плейлист в Jellyfin → скопировать адрес из адресной строки; плейлисту открыть доступ пользователю «kiosk»; ссылки с ApiKey не нужны).
- History: список «когда · кто · что (Врачи/Документы/…)», «Вернуть эту версию» с подтверждением.

- [ ] **Step 1: Тесты:**
  - `jellyfin.test.ts`: три формата ссылок пользователя (`http://192.168.100.100:8096/web/#/details?id=18317a37f31a2c3bb9ca6cd7d0054d6e&serverId=…`, `http://192.168.100.100:8096/Items/18317a37f31a2c3bb9ca6cd7d0054d6e/Download?ApiKey=…`, `https://videocrab.ru/Items/c00de5b1dff7a1b2f16ba8cf7a139334/Download?ApiKey=…`) → ID; `'https://example.com'` → `null`.
  - `it('вставленная ссылка с ApiKey сохраняется только как ID — ключа нет в отправленных данных')` — проверка тела `PUT`.
  - `it('нераспознанная ссылка показывает ошибку и не добавляется')`.
  - `it('откат версии из истории после подтверждения вызывает restore и обновляет список')`.
- [ ] **Step 2:** → FAIL. **Step 3:** реализовать. **Step 4:** → PASS.
- [ ] **Step 5:** Коммит `Админка: заставка и история`.

### Task 9: Выкладка: перенос данных, Docker, nginx, бэкап

**Files:**
- Create: `admin/Dockerfile` (`node:22-slim`, `npm ci --omit=dev` только для `sharp`, копирует `admin/server/dist`, `admin/web/dist`), `admin/docker-compose.yml` (порт `127.0.0.1:<свободный>:8787`, тома `/opt/maxima-kiosk/content:/content`, `/opt/maxima-kiosk/admin-data:/admin-data`, `restart: unless-stopped`), `deploy/nginx-admin.conf`, `deploy/migrate-content.sh`, `deploy/backup-content.sh`
- Modify: `deploy/remote-install.sh` (админ-часть, идемпотентно), `deploy/README.md`, `.claude/rules/ARCHITECTURE.md` (модули `admin/`, команды), `.claude/CLAUDE.md` (источник правды данных — сервер)

**Interfaces:**
- `migrate-content.sh` (однократно, идемпотентно): если `content/data` нет — `cp -a dist/{data,docs,doctors} content/`; затем заменить `dist/data|docs|doctors` симлинками на `../content/…`. Если `dist/X` уже симлинк — ничего.
- `backup-content.sh` → `/etc/cron.daily/maxima-kiosk-backup`: `tar czf /opt/maxima-kiosk/backups/content-$(date +%F).tgz -C /opt/maxima-kiosk content admin-data`, удалить старше 30 дней.
- Выкладка сайта в README: `rsync -az --exclude data/ --exclude docs/ --exclude doctors/ dist/ root@…:/opt/maxima-kiosk/dist/`.
- `nginx-admin.conf`: `server_name kiosk-admin.339933.net`, `client_max_body_size 32m`, `proxy_pass http://127.0.0.1:<порт>`; certbot `--nginx --redirect`.

- [ ] **Step 1:** Перед выкладкой: пользователь добавил A-запись `kiosk-admin` → `80.78.253.231` (`dig +short kiosk-admin.339933.net` с публичного DNS). Свободный порт: `ss -ltn` на VPS.
- [ ] **Step 2:** `npm test && npm run build && npm run admin:build` → без ошибок.
- [ ] **Step 3:** **С разрешения владельца** (деплой): rsync `dist/` с `--exclude`, `admin/`, `deploy/`; на сервере `migrate-content.sh`, `remote-install.sh`; `docker compose -f admin/docker-compose.yml up -d --build`; `admin:user` для владельца и админа клиники (пароль вводит владелец).
- [ ] **Step 4: Проверка:**
  - `curl -s https://kiosk.339933.net/data/clinic.json | head -c 100` — данные отдаются через симлинк;
  - `curl -sI https://kiosk-admin.339933.net/api/me` → 401;
  - в админке поменять часы работы → через ≤ 3 мин на `kiosk.339933.net` новые часы;
  - повторный `rsync dist/` → правка админки на месте;
  - `ls /opt/maxima-kiosk/backups` после ручного запуска бэкапа.
- [ ] **Step 5:** Коммит `Админка: Docker, nginx, перенос данных, бэкап` (вместе с обновлением `ARCHITECTURE.md` и `.claude/CLAUDE.md`).
