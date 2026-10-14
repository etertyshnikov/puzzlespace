#!/usr/bin/env bash
# SchemaSpy: HTML ER-отчёт из PostgreSQL → frontend/schemaspy/
# Образ пишет в /output — флаг -o НЕ передавать.
# Контейнер от root (иначе Permission denied на bind-mount в WSL).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${ROOT}/frontend/schemaspy"
TMP="$(mktemp -d)"
IMAGE="${SCHEMASPY_IMAGE:-schemaspy/schemaspy:latest}"
SCHEMA="${PG_SCHEMA:-public}"

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

chmod 777 "$TMP"

eval "$(python3 "${ROOT}/scripts/_schemaspy_db_env.py")"

echo "PostgreSQL: ${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}"

echo "SchemaSpy image: $IMAGE"
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull "$IMAGE"

echo "Генерация отчёта (временная папка → frontend/schemaspy/) ..."
docker run --rm --network host --user root \
  -v "${TMP}:/output" \
  "$IMAGE" \
  -t pgsql \
  -host "$PG_HOST" \
  -port "$PG_PORT" \
  -db "$PG_DATABASE" \
  -u "$PG_USER" \
  -p "$PG_PASSWORD" \
  -s "$SCHEMA" \
  -noroutines \
  -noviews

if [ ! -f "${TMP}/index.html" ]; then
  echo "Ошибка: index.html не создан (проверьте права и лог выше)"
  exit 1
fi

rm -rf "${OUT}"
mkdir -p "${OUT}"
cp -a "${TMP}/." "${OUT}/"
chmod -R a+rX "${OUT}"

echo "OK: ${OUT}/index.html ($(du -sh "${OUT}" | cut -f1))"
