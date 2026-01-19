import { CheckCircle, XCircle, AlertTriangle, Minus, ExternalLink, Scale } from 'lucide-react';

const aggregatorColors = {
  glovo: '#00A082',
  yandex: '#FFCC00',
  wolt: '#00C2E8',
};

export default function ComparisonTable({ products, compact = false, showNormalized = false, onToggleNormalized }) {
  const getPositionBadge = (position) => {
    if (position === null) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-full text-xs">
          <Minus className="w-3 h-3" />
          Нет
        </span>
      );
    }
    if (position === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          ТОП 1
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
        <AlertTriangle className="w-3 h-3" />
        №{position}
      </span>
    );
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `${price.toLocaleString()}₸`;
  };

  const getPriceCell = (priceData, aggregator, minPrice, normalizedData, showNormalized) => {
    if (!priceData || !priceData.is_available || priceData.price === null) {
      return (
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <XCircle className="w-4 h-4" />
          <span className="text-sm">Нет</span>
        </div>
      );
    }

    const price = priceData.price;
    const isMin = price === minPrice;
    const isGlovo = aggregator === 'glovo';
    const hasUrl = priceData.url;
    const normalizedPrice = normalizedData?.[aggregator]?.price_per_unit;
    const normalizedUnit = normalizedData?.[aggregator]?.unit;

    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${isMin ? 'text-emerald-600 dark:text-emerald-400' : isGlovo ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
            {formatPrice(price)}
          </span>
          {isMin && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase">МИН</span>}
        </div>

        {hasUrl && (
          <a
            href={priceData.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Ссылка
          </a>
        )}

        {showNormalized && normalizedPrice && (
          <span className="text-xs text-gray-400 mt-1">
            {formatPrice(normalizedPrice)}/{normalizedUnit}
          </span>
        )}
      </div>
    );
  };

  const displayProducts = compact ? products.slice(0, 5) : products;

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
            {showNormalized ? 'Цена за единицу' : 'Показать за кг/л'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600 dark:text-gray-300">Товар</th>
              <th className="text-center py-4 px-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: aggregatorColors.glovo }} />
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Glovo</span>
                </div>
              </th>
              <th className="text-center py-4 px-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: aggregatorColors.yandex }} />
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Yandex</span>
                </div>
              </th>
              <th className="text-center py-4 px-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: aggregatorColors.wolt }} />
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Wolt</span>
                </div>
              </th>
              <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600 dark:text-gray-300">Наша позиция</th>
            </tr>
          </thead>
          <tbody>
            {displayProducts.map((product, index) => {
              const prices = product.prices || {};
              const glovoPrice = prices.glovo?.price;
              const yandexPrice = prices.yandex?.price;
              const woltPrice = prices.wolt?.price;
              const availablePrices = [glovoPrice, yandexPrice, woltPrice].filter(p => p !== null && p !== undefined);
              const minPrice = availablePrices.length > 0 ? Math.min(...availablePrices) : null;

              return (
                <tr
                  key={product.id}
                  className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{product.category_name}</span>
                        {product.brand && (
                          <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                            {product.brand}
                          </span>
                        )}
                      </div>
                      {product.weight_info && (
                        <span className="text-xs text-gray-400 mt-0.5 block">
                          {product.weight_info.display}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getPriceCell(prices.glovo, 'glovo', minPrice, product.normalized_prices, showNormalized)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getPriceCell(prices.yandex, 'yandex', minPrice, product.normalized_prices, showNormalized)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getPriceCell(prices.wolt, 'wolt', minPrice, product.normalized_prices, showNormalized)}
                  </td>
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

