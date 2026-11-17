#!/usr/bin/env bash
# Однократный перенос данных киоска из сборки в content/ (их правит админка) + симлинки.
# Идемпотентен: повторный запуск ничего не ломает.
set -euo pipefail
APP=/opt/maxima-kiosk
mkdir -p $APP/content $APP/admin-data $APP/backups
for d in data docs doctors; do
  if [ -L $APP/dist/$d ]; then
    echo "dist/$d уже симлинк — пропускаю"
    continue
  fi
  if [ ! -d $APP/content/$d ]; then
    cp -a $APP/dist/$d $APP/content/$d
    echo "скопировано dist/$d → content/$d"
  fi
  rm -rf $APP/dist/$d
  ln -s ../content/$d $APP/dist/$d
  echo "dist/$d → ../content/$d"
done
# Админка в контейнере работает от пользователя node (uid 1000).
chown -R 1000:1000 $APP/content $APP/admin-data
chmod -R a+rX $APP/content
