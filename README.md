# Algo

Короткие команды для локального запуска

Backend (Django + PostgreSQL)
- Перейти в папку backend:
  cd backend
- Создать и активировать venv:
  python3 -m venv venv
  source venv/bin/activate
- Установить зависимости:
  pip install -r requirements.txt
- Установить переменные окружения (пример):
  export DATABASE_URL='postgres://user:pass@host:5432/dbname'
  export SECRET_KEY='your-secret'
  export DEBUG='True'
- Выполнить миграции и запустить:
  python manage.py migrate
  python manage.py runserver 0.0.0.0:8000

Frontend (React + Vite)
- Перейти в папку проекта:
  cd Algobot
- Установить зависимости:
  npm install
- Запустить dev-сервер (локально указать API если нужно):
  VITE_API_URL='http://localhost:8000/api' npm run dev
- Сборка для продакшна:
  VITE_API_URL='https://your-backend.example.com/api' npm run build

Деплой
- Фронтенд: Vercel — подключить репозиторий и в Settings → Environment Variables добавить VITE_API_URL.
- Бэкенд: используйте Render/Railway/Fly и укажите DATABASE_URL, SECRET_KEY; выполните migrate в деплое/CI.
