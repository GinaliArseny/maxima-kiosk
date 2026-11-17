# Деплой киоска — kiosk.339933.net

- VPS: **80.78.253.231** (Reg.ru), `ssh -i ~/.ssh/id_ed25519 root@80.78.253.231`. Соседи: patient-anketa, profosmotr, teampulse, aquarius, implant.
- Каталог `/opt/maxima-kiosk/`:
  - `dist/` — сборка сайта (статика, отдаёт системный nginx); `dist/data`, `dist/docs`, `dist/doctors` — симлинки в `content/`;
  - `content/{data,docs,doctors,history}` — **данные киоска, источник правды**, правит админка;
  - `admin/` — сервер админки (Docker, `127.0.0.1:8096`), `admin-data/users.json` — пользователи админки;
  - `backups/` — ежедневные архивы `content/` и `admin-data/` (30 дней);
  - `deploy/` — конфиги и скрипты.
- Админка: **https://kiosk.339933.net/admin/** (nginx проксирует `/admin/` в контейнер).

## Сборка (локально)

```bash
npm ci && npm test && npm run build && npm run admin:build
```

`npm run build` сам убирает из `dist/` данные (`data/`, `docs/`, `doctors/`) — на сервере их правит админка.

## Выкладка

```bash
rsync -az --exclude data/ --exclude docs/ --exclude doctors/ dist/ root@80.78.253.231:/opt/maxima-kiosk/dist/
rsync -az deploy/ root@80.78.253.231:/opt/maxima-kiosk/deploy/
rsync -az --relative admin/Dockerfile admin/.dockerignore admin/docker-compose.yml admin/server/dist admin/web/dist root@80.78.253.231:/opt/maxima-kiosk/
ssh -i ~/.ssh/id_ed25519 root@80.78.253.231 'cd /opt/maxima-kiosk && bash deploy/migrate-content.sh && docker compose -f admin/docker-compose.yml up -d --build && bash deploy/remote-install.sh'
```

- **Никогда без `--exclude`** для `dist/`: иначе rsync заменит симлинки на старые данные из сборки и затрёт правки админки.
- **Без `--delete`**: старые `assets/*-<хэш>.js` не удаляем — страница на старом коде до своей перезагрузки может лениво запросить старый чанк (просмотрщик PDF).
- `migrate-content.sh` идемпотентен: при первом запуске переносит данные из `dist/` в `content/` и ставит симлинки, дальше ничего не делает.
- `remote-install.sh` идемпотентен: nginx-конфиг сайта (его дописал certbot) не перезаписывает, а один раз вставляет `include deploy/nginx-admin.inc;` в server-блок 443; если `nginx -t` не прошёл — возвращает бэкап конфига. Ставит `/etc/cron.daily/maxima-kiosk-backup`.

## Пользователи админки

Пароль вводит сам владелец (в чат не передаётся):

```bash
ssh -t -i ~/.ssh/id_ed25519 root@80.78.253.231 'docker exec -it maxima-kiosk-admin node user.mjs <логин>'
```

Та же команда меняет пароль существующему пользователю. Удалить — убрать запись из `/opt/maxima-kiosk/admin-data/users.json`. Сессии живут в памяти: после перезапуска контейнера нужно войти заново.

## Обновление данных и документов

Через админку: врачи, документы, прайс, сведения о клинике, надзорные органы, заставка. Сохранение сразу публикует; история и откат — раздел «История».

**Когда киоск увидит изменения.** Каждое сохранение обновляет `content/data/version.json`. Сайт киоска раз в минуту сверяет версию и при смене перезагружается в ближайший простой (90 с без касаний) — итого 1–3 минуты. Запасной таймер: раз в 30 минут простоя страница перезагружается в любом случае.

Руками (если админка недоступна): правка файлов в `/opt/maxima-kiosk/content/data/` на сервере; проверка — `npm run check-content` на копии. Данные в репо (`public/data`) — только стартовое наполнение и данные для разработки.

## Временное приостановление работы (п. 27)

Админка → «Клиника» → «Приостановка работы»: включить, даты (включительно, по Москве), текст. Баннер появится на всех экранах в эти даты и пропадёт сам.

## Восстановление из архива

```bash
cd /opt/maxima-kiosk && tar xzf backups/content-<ДАТА>.tgz -C /opt/maxima-kiosk && chown -R 1000:1000 content admin-data
```

## Проверка

```bash
curl -sI https://kiosk.339933.net/ | head -1                      # 200
curl -s https://kiosk.339933.net/data/clinic.json | head -c 200    # данные через симлинк
curl -s -o /dev/null -w "%{http_code}\n" https://kiosk.339933.net/admin/api/me   # 401
curl -sI https://kiosk.339933.net/sw.js | grep -i cache-control   # no-cache
```
