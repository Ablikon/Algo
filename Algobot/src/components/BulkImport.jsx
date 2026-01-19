import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, Download, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { importAPI } from '../services/api';

const importTypes = [
  { id: 'products', name: 'Товары', description: 'Импорт товаров с категориями, брендами и весом' },
  { id: 'prices', name: 'Цены', description: 'Импорт цен для товаров по агрегаторам' },
  { id: 'links', name: 'Ссылки', description: 'Импорт ссылок на товары в агрегаторах' },
  { id: 'categories', name: 'Категории', description: 'Импорт структуры категорий (родитель/дочерняя)' },
];

export default function BulkImport({ onImportComplete }) {
  const [selectedType, setSelectedType] = useState('products');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
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
      setFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      let response;
      switch (selectedType) {
        case 'products':
          response = await importAPI.uploadProducts(formData);
          break;
        case 'prices':
          response = await importAPI.uploadPrices(formData);
          break;
        case 'links':
          response = await importAPI.uploadLinks(formData);
          break;
        case 'categories':
          response = await importAPI.uploadCategories(formData);
          break;
        default:
          throw new Error('Unknown import type');
      }
      setResult(response.data);
      if (onImportComplete) onImportComplete();
    } catch (error) {
      setResult({
        status: 'failed',
        error: error.response?.data?.error || error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open(importAPI.downloadTemplate(selectedType), '_blank');
  };

  const resetUpload = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Импорт данных</h3>

      {/* Import Type Selection */}
      <div className="flex gap-2 mb-6">
        {importTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setSelectedType(type.id);
              resetUpload();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedType === type.id
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {type.name}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 mb-4">
        {importTypes.find(t => t.id === selectedType)?.description}
      </p>

      {/* Download Template */}
      <button
        onClick={handleDownloadTemplate}
        className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 mb-6"
      >
        <Download className="w-4 h-4" />
        Скачать шаблон CSV
      </button>

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive
            ? 'border-emerald-500 bg-emerald-50'
            : file
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
            <div className="text-left">
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
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
            <p className="text-sm text-gray-400">CSV или Excel (.xlsx)</p>
          </>
        )}
      </div>

      {/* Upload Button */}
      {file && !result && (
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
              Загрузка...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Импортировать
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
            className={`mt-4 p-4 rounded-xl ${result.status === 'completed'
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-rose-50 border border-rose-200'
              }`}
          >
            {result.status === 'completed' ? (
              <>
                <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2">
                  <Check className="w-5 h-5" />
                  Импорт завершен
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Всего строк</p>
                    <p className="font-semibold text-gray-900">{result.total}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Успешно</p>
                    <p className="font-semibold text-emerald-600">{result.success}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ошибок</p>
                    <p className="font-semibold text-rose-600">{result.errors}</p>
                  </div>
                </div>
                {result.error_details && result.error_details.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-sm text-gray-600 mb-2">Первые ошибки:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {result.error_details.map((err, i) => (
                        <p key={i} className="text-xs text-rose-600">
                          Строка {err.row}: {err.error}
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
