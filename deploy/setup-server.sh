#!/usr/bin/env bash
# ============================================================
# setup-server.sh — первоначальная настройка боевого сервера
# Запускать от root (или через sudo) на чистом Ubuntu Server.
#
# Использование:
#   chmod +x setup-server.sh
#   sudo ./setup-server.sh
# ============================================================
set -euo pipefail

PROJECT_NAME="smetadoma03"
PROJECT_DIR="/opt/$PROJECT_NAME"
REPO_URL="git@github.com:aladdin09/smetadoma05.git"
DB_NAME="${PROJECT_NAME}_db"
DB_USER="$PROJECT_NAME"
SERVICE_FILE="/etc/systemd/system/${PROJECT_NAME}.service"
NGINX_CONF="/etc/nginx/sites-available/${PROJECT_NAME}"

echo "============================================"
echo "  Настройка сервера для $PROJECT_NAME"
echo "============================================"

# --- 2.1  Системные пакеты ---
echo ""
echo "==> [2.1] Установка системных пакетов..."
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv python3-dev \
    nodejs npm nginx git postgresql postgresql-contrib \
    build-essential libpq-dev

# --- 2.2  PostgreSQL ---
echo ""
echo "==> [2.2] Настройка PostgreSQL..."
echo "Создайте пользователя и базу вручную:"
echo ""
echo "  sudo -u postgres psql"
echo "  CREATE USER $DB_USER WITH PASSWORD 'STRONG_PASSWORD';"
echo "  CREATE DATABASE $DB_NAME OWNER $DB_USER;"
echo "  \\q"
echo ""
read -p "Нажмите Enter когда БД будет создана (или Ctrl+C для отмены)..."

# --- 2.3  Клонирование проекта ---
echo ""
echo "==> [2.3] Клонирование проекта..."
if [ -d "$PROJECT_DIR" ]; then
    echo "Директория $PROJECT_DIR уже существует. Пропускаем клонирование."
    cd "$PROJECT_DIR"
    git pull
else
    cd /opt
    git clone "$REPO_URL" "$PROJECT_NAME"
    cd "$PROJECT_DIR"
fi

# --- 2.4  Python виртуальное окружение ---
echo ""
echo "==> [2.4] Настройка Python-окружения..."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# --- 2.5  Создание .env ---
echo ""
echo "==> [2.5] Создание .env..."
if [ ! -f "$PROJECT_DIR/.env" ]; then
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
    cat > "$PROJECT_DIR/.env" <<ENVEOF
DB_URI=postgresql://${DB_USER}:STRONG_PASSWORD@localhost:5432/${DB_NAME}
JWT_SECRET_KEY=${JWT_SECRET}
APP_PRODUCTION=true
ENVEOF
    echo "Файл .env создан. ОБЯЗАТЕЛЬНО отредактируйте пароль БД!"
    echo "  nano $PROJECT_DIR/.env"
    read -p "Нажмите Enter когда .env будет отредактирован..."
else
    echo ".env уже существует. Пропускаем."
fi

# --- 2.6  Сборка фронтенда ---
echo ""
echo "==> [2.6] Сборка фронтенда..."
cd "$PROJECT_DIR/frontend"
npm install
npm run build
cd "$PROJECT_DIR"

# --- 2.7  Systemd-сервис ---
echo ""
echo "==> [2.7] Установка systemd-сервиса..."
cp "$PROJECT_DIR/deploy/smetadoma03.service" "$SERVICE_FILE"
chown -R www-data:www-data "$PROJECT_DIR"
systemctl daemon-reload
systemctl enable "$PROJECT_NAME"
systemctl start "$PROJECT_NAME"
echo "Статус сервиса:"
systemctl status "$PROJECT_NAME" --no-pager || true

# --- 2.8  Nginx ---
echo ""
echo "==> [2.8] Настройка Nginx..."
cp "$PROJECT_DIR/deploy/nginx-smetadoma03.conf" "$NGINX_CONF"
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# --- Файрвол ---
echo ""
echo "==> Настройка файрвола (UFW)..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw --force enable

echo ""
echo "============================================"
echo "  Готово! Проверьте:"
echo "  - http://IP_СЕРВЕРА (фронтенд)"
echo "  - http://IP_СЕРВЕРА/health (API healthcheck)"
echo "  - http://IP_СЕРВЕРА/docs (Swagger UI)"
echo "============================================"
