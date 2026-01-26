import { useState, useEffect } from "react";
import { importAPI } from "../services/api";

const ExternalImportProgressBar = () => {
  const [status, setStatus] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer;

    const checkStatus = async () => {
      try {
        const response = await importAPI.getExternalImportProgress();
        const data = response.data;

        if (data) {
          setStatus(data);

          const isRunning = data.is_running;
          const hasProgress =
            (data.processed_items > 0 && data.processed_items < data.total_items) ||
            (data.processed_files > 0 && data.processed_files < data.total_files);

          if (isRunning || hasProgress) {
            setVisible(true);
          } else if (!isRunning && (data.total_items > 0 || data.total_files > 0)) {
            setVisible(true);
            if (!timer) {
              timer = setTimeout(() => setVisible(false), 10000);
            }
          } else {
            setVisible(false);
          }
        }
      } catch (err) {
        console.error("Error polling external import status:", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2000);

    return () => {
      clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!visible || !status) return null;

  const total = status.total_items || 0;
  const processed = status.processed_items || 0;
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  let colorClass = "bg-indigo-600";
  if (status.is_running) colorClass = "bg-indigo-600 animate-pulse";
  if (!status.is_running && percentage === 100) colorClass = "bg-emerald-500";

  return (
    <div className="w-full mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">
            {status.is_running ? "Импорт данных из API..." : "Импорт завершён"}
          </h3>
          <p className="text-xs text-gray-500">
            {status.current_file || "Подготовка..."}
            {status.current_item ? ` • ${status.current_item}` : ""}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-gray-800">{percentage}%</span>
          <p className="text-xs text-gray-500">
            {processed} / {total} items
          </p>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ease-out ${colorClass}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>
          Files: {status.processed_files} / {status.total_files}
        </span>
        <span>Errors: {status.errors}</span>
      </div>
    </div>
  );
};

export default ExternalImportProgressBar;
