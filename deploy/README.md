# Деплой киоска — kiosk.339933.net

- VPS: **80.78.253.231** (Reg.ru), `ssh -i ~/.ssh/id_ed25519 root@80.78.253.231`. Соседи: patient-anketa, profosmotr, teampulse, aquarius, implant.
- Каталог: `/opt/maxima-kiosk/` (`dist/` — сайт, `deploy/` — конфиги).
- Сайт — чистая статика, отдаёт системный nginx. Своих процессов, портов и контейнеров нет.

## Первичная установка

1. **DNS.** В Reg.ru, зона `339933.net`: A-запись `kiosk` → `80.78.253.231`. Проверка: `dig +short kiosk.339933.net`.
2. **Сборка** (локально):

   ```bash
   npm ci && npm test && npm run check-content && npm run build
   ```

3. **Выкладка:**

   ```bash
   rsync -az dist/ root@80.78.253.231:/opt/maxima-kiosk/dist/
   rsync -az deploy/ root@80.78.253.231:/opt/maxima-kiosk/deploy/
   ssh -i ~/.ssh/id_ed25519 root@80.78.253.231 'bash /opt/maxima-kiosk/deploy/remote-install.sh'
   ```

   Скрипт ставит конфиг в `sites-available/maxima-kiosk`, перезагружает nginx и выпускает сертификат (`certbot --nginx --redirect`).

## Обновление данных и документов

1. PDF → `public/docs/<имя>.pdf`; ссылка на него — элемент `{"kind": "pdf", "file": "<имя>.pdf", ...}` в `public/data/documents.json`.
2. Реквизиты, режим работы, главврач, баннер приостановки, ссылка на игру — `public/data/clinic.json`. Врачи — `doctors.json`. Надзорные органы — `authorities.json`.
3. `npm run check-content` — должна быть таблица без `✗`. Пока `clinic.demo: true`, на киоске висит лента «ДЕМО-ДАННЫЕ».
4. `npm run build` и `rsync -az dist/ root@80.78.253.231:/opt/maxima-kiosk/dist/`.

**Когда киоск увидит изменения.** Страница работает неделями без перезапуска, поэтому при простое (90 с без касаний), если она открыта дольше 30 минут, киоск сам перезагружается: перечитывает `data/*.json` и PDF («сначала сеть») и ставит новую сборку (service worker с `skipWaiting`). Итого изменения доезжают в пределах ~30 минут после выкладки; срочно — перезапустить Chrome на киоске.

**Без `--delete`.** Старые файлы `assets/*-<хэш>.js` не удаляем при выкладке: страница на старом коде до своей перезагрузки может лениво запросить старый чанк (просмотрщик PDF). Чистить `assets/` от старых хэшей можно изредка вручную, через сутки после выкладки.

## Временное приостановление работы (п. 27)

В `clinic.json`:

```json
"suspension": { "active": true, "from": "2026-12-01", "to": "2026-12-03", "text": "1–3 декабря клиника закрыта на санитарную обработку" }
```

Баннер появится на всех экранах в эти даты (включительно, по Москве) и пропадёт сам.

## Проверка

```bash
curl -sI https://kiosk.339933.net/ | head -1          # 200
curl -s https://kiosk.339933.net/data/clinic.json | head -c 200
curl -sI https://kiosk.339933.net/sw.js | grep -i cache-control   # no-cache
```
