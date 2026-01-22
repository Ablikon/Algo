import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Check, X, AlertCircle, Loader2, Database, FileJson } from 'lucide-react';
import { importAPI } from '../services/api';

export default function BulkImport({ onImportComplete }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // JSON file upload state
  const [jsonFile, setJsonFile] = useState(null);
  const [dryRun, setDryRun] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.json')) {
        setJsonFile(file);
        setResult(null);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setJsonFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!jsonFile) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', jsonFile);
      formData.append('dry_run', dryRun);

      const response = await importAPI.uploadJson(formData);

      setResult({
        status: response.data.status === 'completed' ? 'completed' : 'completed_with_errors',
        total: response.data.total_read || 0,
        success: response.data.total_imported || 0,
        errors: response.data.errors || 0,
        by_aggregator: response.data.by_aggregator,
        by_category: response.data.by_category,
        error_details: response.data.error_messages,
      });

      if (!dryRun && onImportComplete) onImportComplete();
    } catch (error) {
      setResult({
        status: 'failed',
        error: error.response?.data?.detail || error.response?.data?.error || error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setJsonFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Импорт данных</h3>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 mb-4">
        Импорт товаров из JSON файлов
      </p>

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive
            ? 'border-emerald-500 bg-emerald-50'
            : jsonFile
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-gray-200 hover:border-gray-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        {jsonFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileJson className="w-8 h-8 text-emerald-500" />
            <div className="text-left">
              <p className="font-medium text-gray-900">{jsonFile.name}</p>
              <p className="text-sm text-gray-500">
                {(jsonFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetUpload();
              }}
              className="p-1 hover:bg-gray-200 rounded-full"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-1">
              Перетащите файл сюда или нажмите для выбора
            </p>
            <p className="text-sm text-gray-400">JSON файл</p>
          </>
        )}
      </div>

      {/* Options */}
      {jsonFile && !result && (
        <div className="mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-600">Тестовый запуск (без сохранения)</span>
          </label>
        </div>
      )}

      {/* Upload Button */}
      {jsonFile && !result && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleUpload}
          disabled={uploading}
          className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white py-3 rounded-xl font-medium transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {dryRun ? 'Анализ...' : 'Импорт...'}
            </>
          ) : (
            <>
              <Database className="w-5 h-5" />
              {dryRun ? 'Проверить' : 'Импортировать'}
            </>
          )}
        </motion.button>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-4 p-4 rounded-xl ${
              result.status === 'completed' || result.status === 'completed_with_errors'
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-rose-50 border border-rose-200'
            }`}
          >
            {result.status === 'completed' || result.status === 'completed_with_errors' ? (
              <>
                <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2">
                  <Check className="w-5 h-5" />
                  {dryRun ? 'Анализ завершен' : 'Импорт завершен'}
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Всего найдено</p>
                    <p className="font-semibold text-gray-900">{result.total}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">{dryRun ? 'Будет импортировано' : 'Успешно'}</p>
                    <p className="font-semibold text-emerald-600">{result.success}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ошибок</p>
                    <p className="font-semibold text-rose-600">{result.errors}</p>
                  </div>
                </div>

                {/* Show aggregator breakdown */}
                {result.by_aggregator && Object.keys(result.by_aggregator).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-sm text-gray-600 mb-2">По агрегаторам:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.by_aggregator).map(([name, count]) => (
                        <span key={name} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          {name}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show categories breakdown */}
                {result.by_category && Object.keys(result.by_category).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-sm text-gray-600 mb-2">По категориям:</p>
                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                      {Object.entries(result.by_category).slice(0, 10).map(([name, count]) => (
                        <span key={name} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                          {name}: {count}
                        </span>
                      ))}
                      {Object.keys(result.by_category).length > 10 && (
                        <span className="text-xs text-gray-500">
                          +{Object.keys(result.by_category).length - 10} еще
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {result.error_details && result.error_details.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-sm text-gray-600 mb-2">Ошибки:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {result.error_details.slice(0, 5).map((err, i) => (
                        <p key={i} className="text-xs text-rose-600">
                          {typeof err === 'string' ? err : JSON.stringify(err)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-rose-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Ошибка: {result.error}</span>
              </div>
            )}

            <button
              onClick={resetUpload}
              className="mt-4 w-full py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Загрузить другой файл
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
