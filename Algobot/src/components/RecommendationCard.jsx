import { motion } from 'framer-motion';
import { ArrowDown, Plus, Check, X, TrendingDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function RecommendationCard({ recommendation, onApply, onReject, isApplying }) {
  const { t } = useLanguage();
  console.log('Recommendation data:', recommendation);
  const isLowerPrice = recommendation.action_type === 'LOWER_PRICE';
  const isAddProduct = recommendation.action_type === 'ADD_PRODUCT';

  const priorityColors = {
    HIGH: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    LOW: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  };

  const priorityLabels = {
    HIGH: t('high'),
    MEDIUM: t('medium'),
    LOW: t('low'),
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `${Number(price).toLocaleString()}₸`;
  };

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border transition-all h-full flex flex-col ${recommendation.status === 'APPLIED'
        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
        : recommendation.status === 'REJECTED'
          ? 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 opacity-60'
          : 'border-gray-100 dark:border-slate-700 hover:shadow-md hover:border-gray-200 dark:hover:border-slate-600'
        }`}
    >
      {/* Header - Fixed height with improved overflow handling */}
      <div className="flex items-start justify-between mb-3 min-h-[64px] gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLowerPrice ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
            }`}>
            {isLowerPrice ? (
              <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 leading-tight h-[2.5rem]" title={recommendation.product_name}>
              {recommendation.product_name}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 overflow-hidden">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[100px] font-medium uppercase tracking-tighter">{recommendation.category_name}</p>
              {recommendation.brand && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 truncate max-w-[70px]">
                  {recommendation.brand}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tighter border flex-shrink-0 whitespace-nowrap ${priorityColors[recommendation.priority]}`}>
          {priorityLabels[recommendation.priority] || recommendation.priority}
        </span>
      </div>

      {/* Price comparison - Fixed height */}
      <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 mb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {isAddProduct ? t('notInStock') : t('current')}
            </p>
            <p className={`text-lg font-bold ${isAddProduct ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
              {isAddProduct ? '—' : formatPrice(recommendation.current_price)}
            </p>
          </div>

          <div className="px-3">
            <ArrowDown className="w-5 h-5 text-emerald-500 rotate-[-90deg]" />
          </div>

          <div className="text-center flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('recommended')}</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatPrice(recommendation.recommended_price)}
            </p>
          </div>
        </div>

        {/* Savings - Always reserve space */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600 text-center h-6">
          {recommendation.potential_savings ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('savings')}: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatPrice(recommendation.potential_savings)}</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* Competitor info - Fixed height */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4 h-5">
        <span className="truncate">{t('minCompetitor')}: {formatPrice(recommendation.competitor_price)}</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">-1₸ {t('lowerBy')}</span>
      </div>

      {/* Actions - Push to bottom */}
      <div className="mt-auto">
        {recommendation.status === 'PENDING' && (
          <div className="flex gap-2">
            <button
              onClick={() => onApply(recommendation.id)}
              disabled={isApplying}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isApplying ? t('applying') : t('apply')}
            </button>
            <button
              onClick={() => onReject(recommendation.id)}
              disabled={isApplying}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              {t('reject')}
            </button>
          </div>
        )}

        {recommendation.status === 'APPLIED' && (
          <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 py-2.5">
            <Check className="w-5 h-5" />
            <span className="font-medium">{t('successApplied')}</span>
          </div>
        )}

        {recommendation.status === 'REJECTED' && (
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 py-2.5">
            <X className="w-5 h-5" />
            <span className="font-medium">{t('rejected')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
