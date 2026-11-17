#!/usr/bin/env bash
# Ежедневный архив данных киоска и пользователей админки; хранится 30 дней.
# Ставится в /etc/cron.daily/maxima-kiosk-backup скриптом remote-install.sh.
set -euo pipefail
APP=/opt/maxima-kiosk
mkdir -p $APP/backups
tar czf $APP/backups/content-$(date +%F).tgz -C $APP content admin-data
find $APP/backups -name 'content-*.tgz' -mtime +30 -delete
