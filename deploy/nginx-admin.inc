# Админка киоска — подключается строкой include в server-блок kiosk.339933.net (listen 443).
location = /admin {
    return 301 /admin/;
}
location /admin/ {
    client_max_body_size 32m;
    proxy_pass http://127.0.0.1:8096;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header Cache-Control "no-store" always;
}
