# Smetadoma03 — FastAPI + React

Приложение на FastAPI по мотивам `db.py` (CRM для учёта клиентов и номенклатуры деревянных домов). Фронтенд — React-дашборд в `frontend/`.

## Структура

- `app/` — код API: `main.py`, `config.py`, `database.py`, `models/`, `schemas/`, `routers/`
- `frontend/` — React-дашборд (Vite + React + TypeScript + Tailwind): дашборд, клиенты, филиалы, источники лидов
- `static/` — статика в корне проекта (как принято в FastAPI):
  - `static/css/app.css` — точка входа для стилей
  - `static/vuexy/` — тема Vuexy (CSS/JS/картинки)

## Запуск

**1. Бэкенд (API)**

```bash
cd /opt/fastapi/smetadoma03
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Отредактировать .env: DB_URI для PostgreSQL
python run.py
```

API: http://localhost:8008  
Документация: http://localhost:8008/docs  

**2. Фронтенд (React-дашборд)**

```bash
cd /opt/fastapi/smetadoma03/frontend
npm install
npm run dev
```

Дашборд: http://localhost:5173  

Vite проксирует запросы `/api`, `/static`, `/health` на `http://localhost:8008`, поэтому при запущенном бэкенде всё работает без CORS.

Публичная главная — меню «Дом на Юге» по адресу `/`. Личный кабинет посетителя: `/cabinet` (регистрация по почте и согласие на обработку персональных данных). Дашборд сотрудников: `/dashboard`. Кнопка «Объявления на модерации» открывает `/moderation`: вакансия, резюме, продажа и покупка участка публикуются только после разрешения и только в свою группу Max, свой канал Telegram и свой адрес Дзена.

## Переменные окружения

- `DB_URI` — строка подключения PostgreSQL (по умолчанию из `.env.example`).

## API (примеры)

- `GET /api/customers` — список клиентов
- `GET /api/branches` — филиалы
- `GET /api/lead-sources` — источники лидов
- `GET /health`, `GET /health/db` — проверка работы и БД

Дальнейшие роутеры (проекты, спецификации, заказы и т.д.) можно добавить по аналогии с `app/routers/customers.py`.
