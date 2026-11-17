#!/usr/bin/env bash
# Первичная установка/обновление конфига nginx и сертификата киоска на VPS.
# Идемпотентен. Запуск на сервере: bash /opt/maxima-kiosk/deploy/remote-install.sh
set -euo pipefail

APP=/opt/maxima-kiosk
DOMAIN=kiosk.339933.net
say() { printf '\n== %s\n' "$*"; }

say "проверка сборки"
test -f $APP/dist/index.html || { echo "нет $APP/dist/index.html — сначала rsync dist/"; exit 1; }

say "nginx"
if [ ! -f /etc/nginx/sites-available/maxima-kiosk ]; then
  cp $APP/deploy/nginx-kiosk.conf /etc/nginx/sites-available/maxima-kiosk
  ln -sf /etc/nginx/sites-available/maxima-kiosk /etc/nginx/sites-enabled/maxima-kiosk
else
  echo "конфиг уже есть (certbot мог дописать ssl) — не перезаписываю"
fi
nginx -t
systemctl reload nginx

say "сертификат"
if [ ! -d /etc/letsencrypt/live/$DOMAIN ]; then
  certbot --nginx -d $DOMAIN --non-interactive --redirect
else
  echo "сертификат уже есть"
fi

say "админка: nginx"
CONF=/etc/nginx/sites-available/maxima-kiosk
INC="include $APP/deploy/nginx-admin.inc;"
if ! grep -qF "$INC" $CONF; then
  cp $CONF $CONF.bak-$(date +%s)
  # Вставка в server-блок с listen 443 (его дописал certbot).
  sed -i "/listen 443 ssl;/a\    $INC" $CONF
  if ! grep -qF "$INC" $CONF; then
    echo "не нашёл строку 'listen 443 ssl;' в $CONF — вставьте вручную в server-блок 443: $INC"
    exit 1
  fi
  if ! nginx -t; then
    echo "nginx -t не прошёл — возвращаю конфиг"
    cp "$(ls -t $CONF.bak-* | head -1)" $CONF
    exit 1
  fi
  systemctl reload nginx
else
  echo "include админки уже есть"
fi

say "админка: бэкап"
install -m 755 $APP/deploy/backup-content.sh /etc/cron.daily/maxima-kiosk-backup

say "проверка"
curl -fsS -o /dev/null -w "https://$DOMAIN/ → %{http_code}\n" https://$DOMAIN/
code=$(curl -sS -o /dev/null -w "%{http_code}" https://$DOMAIN/admin/api/me)
echo "https://$DOMAIN/admin/api/me → $code (ждём 401)"
test "$code" = 401
