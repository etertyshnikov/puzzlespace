#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/fastapi/smetadoma05"
VENV="$PROJECT_DIR/.venv"
SERVICE_NAME="smetadoma05"

cd "$PROJECT_DIR"

echo "==> Pulling latest changes..."
git pull

echo "==> Activating virtualenv..."
source "$VENV/bin/activate"

echo "==> Installing Python dependencies..."
pip install -q -r requirements.txt

echo "==> Building frontend..."
cd "$PROJECT_DIR/frontend"
npm install --silent
npm run build

echo "==> Restarting service..."
sudo systemctl restart "$SERVICE_NAME"

echo "==> Done. Checking status..."
sudo systemctl status "$SERVICE_NAME" --no-pager
