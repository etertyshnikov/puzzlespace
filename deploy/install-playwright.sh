#!/bin/bash
# Зависимости Chromium для PDF (Playwright). Запуск: sudo bash deploy/install-playwright.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source venv/bin/activate
playwright install chromium
playwright install-deps chromium
echo "Playwright Chromium установлен."
