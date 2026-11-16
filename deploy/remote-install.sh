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

say "проверка"
curl -fsS -o /dev/null -w "https://$DOMAIN/ → %{http_code}\n" https://$DOMAIN/
