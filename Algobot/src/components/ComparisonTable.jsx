import { CheckCircle, XCircle, AlertTriangle, Minus, ExternalLink, Scale } from 'lucide-react';

const aggregatorColors = {
  glovo: '#00A082',
  yandex: '#FFCC00',
  wolt: '#00C2E8',
  magnum: '#EE1C25',
  'airba fresh': '#78B833',
  arbuz: '#FF7F00',
  'yandex lavka': '#FFCC00',
};

export default function ComparisonTable({ products, compact = false, showNormalized = false, onToggleNormalized, aggregators: propAggregators }) {
  // Use aggregators from props or fallback to global window or the set in products
  const availableAggregators = propAggregators || window.allAggregators || [];

  const allAggregatorNames = availableAggregators.length > 0
    ? availableAggregators.map(a => a.name.toLowerCase())
    : Array.from(new Set(products.flatMap(p => Object.keys(p.prices || {})))).filter(name => name !== 'our_company');

  const getPositionBadge = (position) => {
    if (position === null) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-full text-[10px]">
          <Minus className="w-3 h-3" />
          Нет
        </span>
      );
    }
    if (position === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-bold">
          <CheckCircle className="w-3 h-3" />
          ТОП 1
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold">
        <AlertTriangle className="w-3 h-3" />
        №{position}
      </span>
    );
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `${Math.round(price).toLocaleString()}₸`;
  };

  const getPriceCell = (priceData, aggregator, minPrice, normalizedData, showNormalized) => {
    if (!priceData || !priceData.is_available || priceData.price === null) {
      return (
        <div className="flex items-center justify-center gap-1 text-gray-300">
          <span className="text-[11px]">Нет</span>
        </div>
      );
    }

    const price = priceData.price;
    const isMin = price === minPrice;
    const isGlovo = aggregator.includes('glovo');
    const hasUrl = priceData.url;
    const normalizedPrice = normalizedData?.[aggregator]?.price_per_unit;
    const normalizedUnit = normalizedData?.[aggregator]?.unit;

    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <span className={`text-xs font-bold ${isMin ? 'text-emerald-600 dark:text-emerald-400' : isGlovo ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
            {formatPrice(price)}
          </span>
          {isMin && <span className="text-[8px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1 py-0.5 rounded font-black">МИН</span>}
        </div>

        {hasUrl && (
          <a
            href={priceData.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            URL
          </a>
        )}

        {showNormalized && normalizedPrice && (
          <span className="text-[10px] text-gray-400">
            {formatPrice(normalizedPrice)}/{normalizedUnit}
          </span>
        )}
      </div>
    );
  };

  const displayProducts = compact ? products.slice(0, 5) : products;

  // Pre-defined order for stability
  const sortedAggregators = [
    'glovo',
    'magnum',
    'wolt',
    'yandex lavka',
    'airba fresh',
    'arbuz'
  ].filter(name => allAggregatorNames.includes(name) || availableAggregators.length === 0);

  // Add any unexpected aggregators
  allAggregatorNames.forEach(name => {
    if (!sortedAggregators.includes(name)) {
      sortedAggregators.push(name);
    }
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      {/* Normalization Toggle */}
      {!compact && onToggleNormalized && (
        <div className="px-6 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-end">
          <button
            onClick={onToggleNormalized}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showNormalized
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
          >
            <Scale className="w-4 h-4" />
            {showNormalized ? 'Показать за шт' : 'Цена за кг/л'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600 dark:text-gray-300 min-w-[200px]">Товар</th>

              {sortedAggregators.map(agg => (
                <th key={agg} className="text-center py-4 px-2 min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: aggregatorColors[agg] || '#94a3b8' }}>
                      <span className="text-[10px] text-white font-black uppercase">{agg.charAt(0)}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter">{agg}</span>
                  </div>
                </th>
              ))}

              <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600 dark:text-gray-300">Позиция</th>
            </tr>
          </thead>
          <tbody>
            {displayProducts.map((product, index) => {
              const prices = product.prices || {};
              const priceValues = sortedAggregators.map(agg => prices[agg]?.price).filter(p => p !== null && p !== undefined);
              const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;

              return (
                <tr
                  key={product.id}
                  className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white line-clamp-1 text-sm" title={product.name}>{product.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{product.category_name}</span>
                        {product.brand && (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate max-w-[100px]">
                            {product.brand}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {sortedAggregators.map(agg => (
                    <td key={agg} className="py-4 px-2 text-center">
                      {getPriceCell(prices[agg], agg, minPrice, product.normalized_prices, showNormalized)}
                    </td>
                  ))}

                  <td className="py-4 px-6 text-center">
                    {getPositionBadge(product.our_position)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayProducts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Нет товаров для отображения
        </div>
      )}
    </div>
  );
}

