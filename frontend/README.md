# СметаДома — React-дашборд

Дашборд CRM: дашборд с карточками, клиенты (список, добавление/редактирование), филиалы, источники лидов.

## Стек

- Vite + React 18 + TypeScript
- React Router 6
- Tailwind CSS

## Запуск

Сначала запустите бэкенд (из корня проекта):

```bash
cd /opt/fastapi/smetadoma03 && source .venv/bin/activate && python run.py
```

Затем фронтенд:

```bash
cd /opt/fastapi/smetadoma03/frontend
npm install
npm run dev
```

Откройте http://localhost:5173

## Сборка

```bash
npm run build
```

Статику из `dist/` можно раздавать через FastAPI или nginx.
