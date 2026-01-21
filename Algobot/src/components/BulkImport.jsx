import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, Download, Check, X, AlertCircle, Loader2, Database, FileJson, Settings2 } from 'lucide-react';
import { importAPI, exportAPI, categoriesResetAPI } from '../services/api';

const importTypes = [
  { id: 'products', name: 'Товары', description: 'Импорт товаров с категориями, брендами и весом', icon: FileSpreadsheet },
  { id: 'prices', name: 'Цены', description: 'Импорт цен для товаров по агрегаторам', icon: FileSpreadsheet },
  { id: 'links', name: 'Ссылки', description: 'Импорт ссылок на товары в агрегаторах', icon: FileSpreadsheet },
  { id: 'categories', name: 'Категории', description: 'Импорт структуры категорий (родитель/дочерняя)', icon: FileSpreadsheet },
  { id: 'json', name: 'JSON из Data', description: 'Импорт из JSON файлов агрегаторов', icon: FileJson },
];

export default function BulkImport({ onImportComplete }) {
  const [selectedType, setSelectedType] = useState('products');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // JSON import state
  const [jsonInfo, setJsonInfo] = useState(null);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedAggregators, setSelectedAggregators] = useState([]);
  const [importLimit, setImportLimit] = useState(100);
  const [dryRun, setDryRun] = useState(false);

  // Load JSON info when switching to JSON type
  useEffect(() => {
    if (selectedType === 'json' && !jsonInfo) {
      loadJsonInfo();
    }
  }, [selectedType]);

  const loadJsonInfo = async () => {
    setJsonLoading(true);
    try {
      const response = await importAPI.getJsonInfo();
      setJsonInfo(response.data);
      // Select all categories and aggregators by default
      if (response.data.categories) {
        setSelectedCategories(response.data.categories.map(c => c.slug));
      }
      if (response.data.files) {
        setSelectedAggregators(response.data.files.filter(f => f.exists).map(f => f.aggregator));
      }
    } catch (error) {
      console.error('Error loading JSON info:', error);
    } finally {
      setJsonLoading(false);
    }
  };

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
    if (selectedType === 'json') {
      await handleJsonImport();
      return;
    }

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

  const handleJsonImport = async () => {
    setUploading(true);
    setResult(null);

    try {
      const response = await importAPI.importFromJson({
        categories: selectedCategories,
        aggregators: selectedAggregators,
        limit: importLimit,
        dry_run: dryRun,
      });

      setResult({
        status: response.data.status === 'completed' ? 'completed' : 'completed_with_errors',
        total: response.data.stats?.total_read || 0,
        success: response.data.total_imported || 0,
        errors: response.data.errors?.length || 0,
        categories: response.data.categories,
        aggregators: response.data.aggregators,
        error_details: response.data.errors,
      });

      if (!dryRun && onImportComplete) onImportComplete();
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
    if (selectedType === 'json') return;
    window.open(importAPI.downloadTemplate(selectedType), '_blank');
  };

  const handleExport = () => {
    window.open(exportAPI.downloadProducts({}), '_blank');
  };

  const handleResetCategories = async () => {
    if (!confirm('Это удалит все существующие категории и создаст структуру Яйца/Газировки/Шоколадки. Продолжить?')) return;

    try {
      await categoriesResetAPI.reset();
      if (onImportComplete) onImportComplete();
      alert('Категории успешно сброшены!');
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.error || error.message));
    }
  };

  const resetUpload = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleCategory = (slug) => {
    setSelectedCategories(prev =>
      prev.includes(slug) ? prev.filter(c => c !== slug) : [...prev, slug]
    );
  };

  const toggleAggregator = (agg) => {
    setSelectedAggregators(prev =>
      prev.includes(agg) ? prev.filter(a => a !== agg) : [...prev, agg]
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Импорт данных</h3>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Экспорт CSV
          </button>
          <button
            onClick={handleResetCategories}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Сбросить категории
          </button>
        </div>
      </div>

      {/* Import Type Selection */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {importTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setSelectedType(type.id);
              resetUpload();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedType === type.id
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            <type.icon className="w-4 h-4" />
            {type.name}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 mb-4">
        {importTypes.find(t => t.id === selectedType)?.description}
      </p>

      {/* JSON Import Settings */}
      {selectedType === 'json' ? (
        <div className="space-y-4 mb-6">
          {jsonLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : jsonInfo ? (
            <>
              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Категории</label>
                <div className="flex flex-wrap gap-2">
                  {jsonInfo.categories?.map((cat) => (
                    <button
                      key={cat.slug}
                      onClick={() => toggleCategory(cat.slug)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCategories.includes(cat.slug)
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                        }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aggregators */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Агрегаторы</label>
                <div className="flex flex-wrap gap-2">
                  {jsonInfo.files?.filter(f => f.exists).map((file) => (
                    <button
                      key={file.aggregator}
                      onClick={() => toggleAggregator(file.aggregator)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedAggregators.includes(file.aggregator)
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                        }`}
                    >
                      {file.aggregator} ({file.size_mb} MB)
                    </button>
                  ))}
                </div>
              </div>

              {/* Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Лимит товаров на категорию: {importLimit}
                </label>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={importLimit}
                  onChange={(e) => setImportLimit(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>10</span>
                  <span>500</span>
                  <span>1000</span>
                </div>
              </div>

              {/* Dry Run */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-600">Тестовый запуск (без сохранения)</span>
              </label>
            </>
          ) : (
            <p className="text-sm text-gray-500">Не удалось загрузить информацию о файлах</p>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}

      {/* Upload Button */}
      {((selectedType === 'json' && selectedCategories.length > 0 && selectedAggregators.length > 0) ||
        (selectedType !== 'json' && file)) && !result && (
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
                {selectedType === 'json' ? <Database className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
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
            className={`mt-4 p-4 rounded-xl ${result.status === 'completed' || result.status === 'completed_with_errors'
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

                {/* Show categories breakdown for JSON import */}
                {result.categories && Object.keys(result.categories).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-sm text-gray-600 mb-2">По категориям:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.categories).map(([name, data]) => (
                        <span key={name} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                          {name}: {data.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.error_details && result.error_details.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-sm text-gray-600 mb-2">Первые ошибки:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {result.error_details.slice(0, 5).map((err, i) => (
                        <p key={i} className="text-xs text-rose-600">
                          {typeof err === 'string' ? err : `Строка ${err.row}: ${err.error}`}
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
              {selectedType === 'json' ? 'Попробовать снова' : 'Загрузить другой файл'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
