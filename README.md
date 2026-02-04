# Algo

Короткие команды для локального запуска

Backend (Node.js + MongoDB)
- Перейти в папку backend:
  cd backend
- Установить зависимости:
  npm install
- Создать .env для backend (локальный запуск берёт переменные из backend/.env):
  cp .env.example .env   # если есть шаблон, иначе создайте вручную
- Запустить:
  npm run dev

Frontend (React + Vite)
- Перейти в папку проекта:
  cd Algobot
- Установить зависимости:
  npm install
- Запустить dev-сервер (локально указать API если нужно):
  VITE_API_URL='http://localhost:8000/api' npm run dev
- Сборка для продакшна:
  VITE_API_URL='https://your-backend.example.com/api' npm run build

Примечание по .env:
- Локальный запуск backend читает только `backend/.env`.
- Docker Compose читает корневой `.env` рядом с `docker-compose.yml`.

Деплой
- Фронтенд: Vercel — подключить репозиторий и в Settings → Environment Variables добавить VITE_API_URL.
- Бэкенд: используйте Render/Railway/Fly и укажите DATABASE_URL, SECRET_KEY; выполните migrate в деплое/CI.
