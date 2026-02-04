# 🚀 ScoutAlgo - Быстрый старт

## ✅ Что сделано

1. **Backend полностью переделан на Node.js**
   - Express.js сервер
   - MongoDB подключение
   - Все API эндпоинты работают
   - Синхронизация с внешним API

2. **Frontend подключён к новому бэкенду**
   - React + Vite
   - TailwindCSS
   - Все страницы работают

3. **Данные загружены**
   - 16,998 продуктов
   - 2,361 продукт с ценами
   - 16 агрегаторов
   - 1,222 категории

## 🏃 Как запустить (3 простых шага)

> Для локального backend используется `backend/.env`.
> Для Docker Compose используется корневой `.env` (рядом с `docker-compose.yml`).

### Шаг 1: Запустить Backend
```bash
cd backend
node src/server.js
```
Должно появиться:
```
Server running on port 8000
MongoDB Connected: ...
```

### Шаг 2: Запустить Frontend (в новом терминале)
```bash
cd Algobot
npm run dev
```
Должно появиться:
```
➜  Local:   http://localhost:5173/
```

### Шаг 3: Открыть в браузере
```
http://localhost:5173
```

## 🎯 Основные функции

### 1. Dashboard (Главная страница)
- Общая статистика
- Количество продуктов
- Лучшие позиции
- Графики

### 2. Comparison (Сравнение цен)
- Таблица со всеми продуктами
- Цены по всем агрегаторам
- Фильтры и поиск
- Экспорт в Excel

### 3. Recommendations (Рекомендации)
- AI рекомендации по ценам
- Применить/Отклонить
- Фильтры по статусу

### 4. Analytics (Аналитика)
- Детальные графики
- Анализ конкурентов
- История цен

### 5. DatabaseView (База данных)
- Просмотр всех таблиц
- Импорт данных
- Синхронизация

## 🔄 Синхронизация данных

### Через UI
1. Открыть DatabaseView
2. Нажать "Import" 
3. Выбрать источник данных

### Через API
```bash
# Запустить синхронизацию
curl -X POST http://localhost:8000/api/sync/external-api

# Проверить статус
curl http://localhost:8000/api/sync/status
```

## 🔍 Проверка работы

### Быстрая проверка
```bash
cd backend
node health-check.js
```

Должно вывести:
```
✅ All systems operational!
```

### Ручная проверка
```bash
# Backend
curl http://localhost:8000/api/aggregators/

# Frontend
curl http://localhost:5173/
```

## 📝 Полезные команды

### Остановка
```bash
# Backend
lsof -ti:8000 | xargs kill

# Frontend  
lsof -ti:5173 | xargs kill
```

### Логи
```bash
# Смотреть логи backend (если запущен в фоне)
tail -f /tmp/backend.log

# Смотреть логи frontend (если запущен в фоне)
tail -f /tmp/frontend.log
```

### Очистка
```bash
# Убить все Node процессы
killall node

# Очистить порты
lsof -ti:8000,5173 | xargs kill -9
```

## 🛠 API Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/aggregators/` | Список агрегаторов |
| GET | `/api/products/` | Список продуктов |
| GET | `/api/products/comparison/` | Продукты с ценами |
| GET | `/api/categories/` | Список категорий |
| GET | `/api/recommendations/` | Рекомендации |
| GET | `/api/dashboard/` | Статистика |
| POST | `/api/sync/external-api` | Синхронизация |
| POST | `/api/algorithm/run` | Запустить алгоритм |

## ❗ Что делать если не работает

### Backend не запускается
1. Проверьте файл `backend/.env` 
2. Проверьте MongoDB подключение
3. Убедитесь что порт 8000 свободен:
   ```bash
   lsof -ti:8000 | xargs kill -9
   ```

### Frontend не видит Backend
1. Убедитесь что backend запущен
2. Проверьте CORS в backend/src/server.js
3. Откройте консоль браузера (F12) для ошибок

### Нет данных
1. Запустите синхронизацию:
   ```bash
   curl -X POST http://localhost:8000/api/sync/external-api
   ```
2. Подождите 5-10 минут
3. Обновите страницу

## 📊 Текущее состояние данных

```
Products: 16,998 total
Products with prices: 2,361
Aggregators: 16
Categories: 1,222
Recommendations: 0 (запустите алгоритм)
```

## 🎓 Подробная документация

Смотрите файл `SETUP_RU.md` для полной документации.

---

**Важно**: Сервера должны работать одновременно:
- Backend на `http://localhost:8000`
- Frontend на `http://localhost:5173`

Откройте 2 терминала и запустите каждый сервер в своём окне.
