# ScoutAlgo - Инструкция по запуску

## 🚀 Быстрый старт

### 1. Установка зависимостей

#### Backend (Node.js)
```bash
cd backend
npm install
```

#### Frontend (React + Vite)
```bash
cd Algobot
npm install
```

### 2. Настройка окружения

Важно:
- **Локальный запуск backend** читает `backend/.env`.
- **Docker Compose** читает **корневой** `.env` (рядом с `docker-compose.yml`).

Проверьте файл `backend/.env`:
```env
# MongoDB
MONGO_URI=mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/?appName=ScoutAlgo
MONGO_DB_NAME=scoutalgo

# Внешний API
EXTERNAL_API_BASE=http://94.131.88.146
EXTERNAL_API_TOKEN=7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5

# Настройки API
API_PORT=8000
API_HOST=0.0.0.0

# Наша компания
OUR_COMPANY_AGGREGATOR=Рядом
```

Если используете Docker Compose — продублируйте нужные переменные в корневом `.env`.

### 3. Запуск серверов

#### Вариант 1: Запуск обоих серверов автоматически

**Terminal 1 - Backend:**
```bash
cd backend
node src/server.js
```

**Terminal 2 - Frontend:**
```bash
cd Algobot
npm run dev
```

#### Вариант 2: С логами в фоне

**Backend:**
```bash
cd backend
nohup node src/server.js > /tmp/backend.log 2>&1 &
tail -f /tmp/backend.log
```

**Frontend:**
```bash
cd Algobot
nohup npm run dev > /tmp/frontend.log 2>&1 &
tail -f /tmp/frontend.log
```

### 4. Проверка работы

После запуска откройте в браузере:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/api

Проверка API через curl:
```bash
# Список агрегаторов
curl http://localhost:8000/api/aggregators/

# Продукты
curl http://localhost:8000/api/products/?page=1&page_size=10

# Рекомендации
curl http://localhost:8000/api/recommendations/

# Дашборд
curl http://localhost:8000/api/dashboard/
```

## 📊 Синхронизация данных с внешнего API

### Получение списка доступных файлов
```bash
curl http://localhost:8000/api/import/mapped/api-files/
```

### Запуск полной синхронизации
```bash
curl -X POST http://localhost:8000/api/sync/external-api
```

### Проверка статуса синхронизации
```bash
curl http://localhost:8000/api/sync/status
```

## 🛠 Полезные команды

### Остановка серверов
```bash
# Остановить backend (порт 8000)
lsof -ti:8000 | xargs kill -9

# Остановить frontend (порт 5173)
lsof -ti:5173 | xargs kill -9

# Остановить все Node процессы
killall node
```

### Просмотр логов
```bash
# Backend
tail -f /tmp/backend.log

# Frontend
tail -f /tmp/frontend.log
```

### Проверка портов
```bash
# Проверить что работает на порту 8000
lsof -i:8000

# Проверить что работает на порту 5173
lsof -i:5173
```

## 🗄️ База данных

Проект использует MongoDB Atlas:
- **База**: scoutalgo
- **Коллекции**:
  - `products` - товары
  - `prices` - цены товаров по агрегаторам
  - `aggregators` - маркетплейсы
  - `categories` - категории товаров
  - `recommendations` - рекомендации по ценам
  - `importjobs` - история импортов

## 📝 Структура API

### Основные эндпоинты

#### Aggregators (Агрегаторы)
- `GET /api/aggregators/` - список всех агрегаторов
- `GET /api/cities` - список городов

#### Products (Товары)
- `GET /api/products/` - список всех товаров (с пагинацией)
- `GET /api/products/comparison/` - товары с ценами для сравнения

#### Categories (Категории)
- `GET /api/categories/` - список категорий
- `GET /api/categories/tree/` - дерево категорий

#### Recommendations (Рекомендации)
- `GET /api/recommendations/` - список рекомендаций
- `POST /api/recommendations/:id/apply/` - применить рекомендацию
- `POST /api/recommendations/:id/reject/` - отклонить рекомендацию

#### Analytics (Аналитика)
- `GET /api/dashboard/` - статистика для дашборда
- `GET /api/dashboard/gaps/` - анализ пробелов в ассортименте

#### Import & Sync (Импорт и синхронизация)
- `GET /api/import/mapped/api-files/` - список доступных файлов на внешнем API
- `POST /api/sync/external-api` - запустить синхронизацию с внешнего API
- `GET /api/sync/status` - статус последней синхронизации
- `POST /api/import/baseline` - импорт базовых данных
- `POST /api/algorithm/run` - запуск алгоритма генерации рекомендаций

## 🔧 Разработка

### Backend (Node.js + Express + MongoDB)
- **Фреймворк**: Express 5.x
- **База данных**: MongoDB (через Mongoose)
- **Основные библиотеки**:
  - `axios` - HTTP клиент для внешнего API
  - `cors` - поддержка CORS
  - `dotenv` - переменные окружения

### Frontend (React + Vite)
- **Фреймворк**: React 19.x
- **Сборщик**: Vite 7.x
- **Стили**: TailwindCSS 4.x
- **Основные библиотеки**:
  - `axios` - HTTP клиент
  - `framer-motion` - анимации
  - `react-router-dom` - роутинг
  - `recharts` - графики
  - `lucide-react` - иконки

## ⚠️ Решение проблем

### Backend не запускается
1. Проверьте `.env` файл
2. Проверьте подключение к MongoDB
3. Убедитесь что порт 8000 свободен

### Frontend не подключается к Backend
1. Проверьте что backend запущен на http://localhost:8000
2. Проверьте настройки CORS в backend
3. Проверьте файл `Algobot/src/services/api.js`

### Данные не загружаются
1. Запустите синхронизацию: `curl -X POST http://localhost:8000/api/sync/external-api`
2. Проверьте статус: `curl http://localhost:8000/api/sync/status`
3. Проверьте логи backend

## 📞 Поддержка

При возникновении проблем проверьте:
1. Логи backend: `/tmp/backend.log`
2. Логи frontend: `/tmp/frontend.log`
3. Консоль браузера (F12)
4. MongoDB подключение

---

**Версия**: 2.0 (Node.js Backend)  
**Дата обновления**: Январь 2026
