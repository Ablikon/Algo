import { motion } from 'framer-motion';
import { ArrowDown, Plus, Check, X, TrendingDown } from 'lucide-react';

export default function RecommendationCard({ recommendation, onApply, onReject, isApplying }) {
  const isLowerPrice = recommendation.action_type === 'LOWER_PRICE';
  const isAddProduct = recommendation.action_type === 'ADD_PRODUCT';

  const priorityColors = {
    HIGH: 'bg-rose-100 text-rose-700 border-rose-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    LOW: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const priorityLabels = {
    HIGH: 'Высокий',
    MEDIUM: 'Средний',
    LOW: 'Низкий',
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `${Number(price).toLocaleString()}₸`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`bg-white rounded-2xl p-6 shadow-sm border transition-all ${
        recommendation.status === 'APPLIED'
          ? 'border-emerald-200 bg-emerald-50'
          : recommendation.status === 'REJECTED'
          ? 'border-gray-200 bg-gray-50 opacity-60'
          : 'border-gray-100 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isLowerPrice ? 'bg-amber-100' : 'bg-emerald-100'
          }`}>
            {isLowerPrice ? (
              <TrendingDown className="w-5 h-5 text-amber-600" />
            ) : (
              <Plus className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{recommendation.product_name}</h3>
            <p className="text-sm text-gray-500">{recommendation.category_name}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityColors[recommendation.priority]}`}>
          {priorityLabels[recommendation.priority] || recommendation.priority}
        </span>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">
              {isAddProduct ? 'Нет в наличии' : 'Текущая'}
            </p>
            <p className={`text-lg font-bold ${isAddProduct ? 'text-gray-400' : 'text-gray-900'}`}>
              {isAddProduct ? '—' : formatPrice(recommendation.current_price)}
            </p>
          </div>

          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <ArrowDown className="w-6 h-6 text-emerald-500 rotate-[-90deg]" />
          </motion.div>

          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Рекомендуемая</p>
            <p className="text-lg font-bold text-emerald-600">
              {formatPrice(recommendation.recommended_price)}
            </p>
          </div>
        </div>

        {recommendation.potential_savings && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              Экономия: <span className="font-semibold text-emerald-600">{formatPrice(recommendation.potential_savings)}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span>Мин. у конкурентов: {formatPrice(recommendation.competitor_price)}</span>
        <span className="text-emerald-600 font-medium">-1₸ ниже</span>
      </div>

      {recommendation.status === 'PENDING' && (
        <div className="flex gap-3">
          <button
            onClick={() => onApply(recommendation.id)}
            disabled={isApplying}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isApplying ? 'Применение...' : 'Применить'}
          </button>
          <button
            onClick={() => onReject(recommendation.id)}
            disabled={isApplying}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Отклонить
          </button>
        </div>
      )}

      {recommendation.status === 'APPLIED' && (
        <div className="flex items-center justify-center gap-2 text-emerald-600 py-2.5">
          <Check className="w-5 h-5" />
          <span className="font-medium">Успешно применено</span>
        </div>
      )}

      {recommendation.status === 'REJECTED' && (
        <div className="flex items-center justify-center gap-2 text-gray-500 py-2.5">
          <X className="w-5 h-5" />
          <span className="font-medium">Отклонено</span>
        </div>
      )}
    </motion.div>
  );
}
