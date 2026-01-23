import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, CheckCircle, AlertTriangle, Plus, ArrowRight } from 'lucide-react';

const STEPS = [
  { id: 1, name: 'Загрузка', description: 'Загрузка товаров и цен со всех агрегаторов' },
  { id: 2, name: 'Анализ', description: 'Сравнение цен конкурентов' },
  { id: 3, name: 'Поиск дефицита', description: 'Поиск отсутствующих товаров в нашем каталоге' },
  { id: 4, name: 'Расчёт', description: 'Вычисление оптимальных цен для ТОП-1' },
  { id: 5, name: 'Генерация', description: 'Создание рекомендаций к действию' },
];

const sampleProducts = [
  { name: 'Картошка', glovo: 200, yandex: 150, wolt: 300, action: 'lower', recommended: 149 },
  { name: 'Морковь', glovo: 500, yandex: 500, wolt: 500, action: 'lower', recommended: 499 },
  { name: 'Капуста', glovo: null, yandex: 200, wolt: 300, action: 'add', recommended: 199 },
  { name: 'Помидоры', glovo: 350, yandex: 400, wolt: 380, action: 'top', recommended: null },
];

export default function AlgorithmVisualizer() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [analyzedProducts, setAnalyzedProducts] = useState([]);
  const [currentProductIndex, setCurrentProductIndex] = useState(-1);

  useEffect(() => {
    if (!isRunning) return;

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= STEPS.length) {
          setIsRunning(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);

    return () => clearInterval(stepInterval);
  }, [isRunning]);

  useEffect(() => {
    if (currentStep === 2 && isRunning) {
      const productInterval = setInterval(() => {
        setCurrentProductIndex((prev) => {
          if (prev >= sampleProducts.length - 1) {
            clearInterval(productInterval);
            return prev;
          }
          setAnalyzedProducts((products) => [...products, sampleProducts[prev + 1]]);
          return prev + 1;
        });
      }, 800);

      return () => clearInterval(productInterval);
    }
  }, [currentStep, isRunning]);

  const handleStart = () => {
    setCurrentStep(0);
    setAnalyzedProducts([]);
    setCurrentProductIndex(-1);
    setIsRunning(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStep(0);
    setAnalyzedProducts([]);
    setCurrentProductIndex(-1);
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'lower':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'add':
        return <Plus className="w-4 h-4 text-rose-500" />;
      case 'top':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return null;
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case 'lower':
        return 'Снизить цену';
      case 'add':
        return 'Добавить товар';
      case 'top':
        return 'ТОП 1';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Визуализация алгоритма</h3>
          <p className="text-sm text-gray-500">Посмотрите, как Pricent анализирует цены в реальном времени</p>
        </div>
        <div className="flex gap-2">
          {!isRunning && currentStep === 0 && (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Запустить алгоритм
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => setIsRunning(false)}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Pause className="w-4 h-4" />
              Пауза
            </button>
          )}
          {currentStep > 0 && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                animate={{
                  scale: currentStep === index + 1 ? [1, 1.1, 1] : 1,
                  backgroundColor:
                    currentStep > index
                      ? '#10b981'
                      : currentStep === index + 1
                      ? '#f59e0b'
                      : '#e5e7eb',
                }}
                transition={{ duration: 0.3 }}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep > index
                    ? 'text-white'
                    : currentStep === index + 1
                    ? 'text-white'
                    : 'text-gray-400'
                }`}
              >
                {currentStep > index ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  step.id
                )}
              </motion.div>
              <p className={`text-xs mt-2 font-medium ${
                currentStep >= index + 1 ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {step.name}
              </p>
            </div>
            {index < STEPS.length - 1 && (
              <motion.div
                animate={{
                  backgroundColor: currentStep > index + 1 ? '#10b981' : '#e5e7eb',
                }}
                className="w-16 h-1 mx-2 rounded-full"
              />
            )}
          </div>
        ))}
      </div>

      {/* Current Step Description */}
      <AnimatePresence mode="wait">
        {currentStep > 0 && currentStep <= STEPS.length && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6"
          >
            <p className="text-amber-800 font-medium">
              {STEPS[currentStep - 1]?.description}
              {isRunning && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  ...
                </motion.span>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Analysis Animation */}
      {(currentStep >= 2 || analyzedProducts.length > 0) && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Результаты анализа:</h4>
          <AnimatePresence>
            {analyzedProducts.map((product, index) => (
              <motion.div
                key={product.name}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between bg-gray-50 rounded-xl p-4"
              >
                <div className="flex items-center gap-4">
                  <span className="font-medium text-gray-900 w-24">{product.name}</span>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Glovo</p>
                      <p className={`font-semibold ${product.glovo ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {product.glovo ? `${product.glovo}₸` : '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Yandex</p>
                      <p className="font-semibold text-amber-600">{product.yandex}₸</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Wolt</p>
                      <p className="font-semibold text-blue-600">{product.wolt}₸</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {product.recommended && (
                    <>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="font-bold text-emerald-600">{product.recommended}₸</span>
                    </>
                  )}
                  <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                    product.action === 'top'
                      ? 'bg-emerald-100 text-emerald-700'
                      : product.action === 'add'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {getActionIcon(product.action)}
                    {getActionText(product.action)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Completion Message */}
      {currentStep > STEPS.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center"
        >
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-emerald-800 mb-1">Анализ завершён!</h4>
          <p className="text-emerald-600">
            Найдено {analyzedProducts.filter(p => p.action !== 'top').length} рекомендаций для достижения ТОП-1
          </p>
        </motion.div>
      )}
    </div>
  );
}
