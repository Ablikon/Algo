#!/bin/bash
# Monitor sync progress

echo "Мониторинг синхронизации данных..."
echo "Нажмите Ctrl+C для выхода"
echo ""

while true; do
    clear
    echo "=== СТАТУС СИНХРОНИЗАЦИИ ==="
    echo ""
    
    response=$(curl -s http://localhost:8000/api/sync/status)
    
    status=$(echo $response | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    currentFile=$(echo $response | grep -o '"currentFile":"[^"]*"' | cut -d'"' -f4)
    filesProcessed=$(echo $response | grep -o '"filesProcessed":[0-9]*' | cut -d':' -f2)
    totalFiles=$(echo $response | grep -o '"totalFiles":[0-9]*' | cut -d':' -f2)
    recordsProcessed=$(echo $response | grep -o '"recordsProcessed":[0-9]*' | cut -d':' -f2)
    
    echo "Статус: $status"
    echo "Текущий файл: $currentFile"
    echo "Файлов обработано: $filesProcessed / $totalFiles"
    echo "Записей обработано: $recordsProcessed"
    echo ""
    
    if [ "$status" = "completed" ]; then
        echo "✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!"
        break
    fi
    
    if [ "$status" = "failed" ]; then
        echo "❌ ОШИБКА СИНХРОНИЗАЦИИ"
        break
    fi
    
    sleep 5
done
