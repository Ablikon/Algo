import { CheckCircle, AlertCircle, Minus, ExternalLink, Scale, ArrowUp, ArrowDown } from 'lucide-react';

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
  const availableAggregators = propAggregators || window.allAggregators || [];

  const allAggregatorNames = availableAggregators.length > 0
    ? availableAggregators.map(a => a.name.toLowerCase())
    : Array.from(new Set(products.flatMap(p => Object.keys(p.prices || {})))).filter(name => name !== 'our_company');

  const getPositionBadge = (position, priceDiff) => {
    if (position === null) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 text-gray-400 rounded text-[10px] font-medium border border-gray-100">
          —
        </span>
      );
    }

    if (position === 1) {
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-md text-[11px] font-bold shadow-sm">
            <CheckCircle className="w-3 h-3" />
            Лидер
          </div>
          {priceDiff !== null && priceDiff < 0 && (
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
              {Math.abs(priceDiff)}% <ArrowDown className="w-2.5 h-2.5" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-1">
        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white rounded-md text-[11px] font-bold shadow-sm">
          <AlertCircle className="w-3 h-3" />
          #{position}
        </div>
        {priceDiff !== null && priceDiff > 0 && (
          <div className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
            +{priceDiff}% <ArrowUp className="w-2.5 h-2.5" />
          </div>
        )}
      </div>
    );
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `${Math.round(price).toLocaleString()} ₸`;
  };

  const getPriceCell = (priceData, aggregator, minPrice, maxPrice, normalizedData, showNormalized, isOurCompany) => {
    if (!priceData || !priceData.is_available || priceData.price === null) {
      return (
        <div className="px-2 py-3 text-center">
          <span className="text-gray-300 text-xl font-light">·</span>
        </div>
      );
    }

    const price = priceData.price;
    const isMin = price === minPrice;
    const hasUrl = priceData.url;
    const normalizedPrice = normalizedData?.[aggregator]?.price_per_unit;
    const normalizedUnit = normalizedData?.[aggregator]?.unit;

    // Badge style logic
    let containerClass = "flex flex-col items-center justify-center py-2 px-2 rounded-xl border transition-all duration-200";
    let priceClass = "text-sm font-bold";

    if (isMin) {
      containerClass += " bg-emerald-50 border-emerald-200 shadow-sm";
      priceClass += " text-emerald-700";
    } else if (isOurCompany) {
      containerClass += " bg-blue-50 border-blue-200 shadow-sm";
      priceClass += " text-blue-700";
    } else {
      containerClass += " bg-white border-gray-100 hover:border-gray-200 hover:shadow-md hover:-translate-y-0.5";
      priceClass += " text-gray-700";
    }

    return (
      <div className={containerClass}>
        <div className="flex items-center gap-1.5">
          <span className={priceClass}>
            {formatPrice(price)}
          </span>
          {isMin && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Минимальная цена" />
          )}
        </div>

        {hasUrl && (
          <a
            href={priceData.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="group flex items-center gap-1 mt-1 text-[10px] font-medium text-gray-400 hover:text-blue-500 transition-colors"
          >
            Go <ExternalLink className="w-2.5 h-2.5 group-hover:scale-110 transition-transform" />
          </a>
        )}

        {showNormalized && normalizedPrice && (
          <span className="text-[10px] text-gray-400 mt-0.5 border-t border-gray-100 pt-0.5 w-full text-center">
            {formatPrice(normalizedPrice)}/{normalizedUnit}
          </span>
        )}
      </div>
    );
  };

  const displayProducts = compact ? products.slice(0, 5) : products;

  const sortedAggregators = [
    'glovo',
    'magnum',
    'wolt',
    'yandex lavka',
    'airba fresh',
    'arbuz'
  ].filter(name => allAggregatorNames.includes(name) || availableAggregators.length === 0);

  allAggregatorNames.forEach(name => {
    if (!sortedAggregators.includes(name)) {
      sortedAggregators.push(name);
    }
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      {!compact && onToggleNormalized && (
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex justify-end">
          <button
            onClick={onToggleNormalized}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showNormalized
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
          >
            <Scale className="w-4 h-4" />
            {showNormalized ? 'Цена за шт' : 'Цена за ед.'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-200">
              <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[250px]">
                Товар
              </th>

              {sortedAggregators.map((agg, idx) => (
                <th key={agg} className="py-4 px-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>{agg === 'glovo' ? 'Наши Цены' : agg}</span>
                    <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: aggregatorColors[agg] || '#cbd5e1' }} />
                  </div>
                </th>
              ))}

              <th className="py-4 px-6 text-center text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[140px]">
                Статус
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayProducts.map((product) => {
              const prices = product.prices || {};
              const priceValues = sortedAggregators.map(agg => prices[agg]?.price).filter(p => p !== null && p !== undefined);
              const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;
              const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : null;

              const ourPrice = prices['glovo']?.price;
              const competitorPrices = sortedAggregators.slice(1).map(agg => prices[agg]?.price).filter(p => p !== null && p !== undefined);
              const minCompetitor = competitorPrices.length > 0 ? Math.min(...competitorPrices) : null;

              let priceDiff = null;
              if (ourPrice && minCompetitor) {
                priceDiff = Math.round(((ourPrice - minCompetitor) / minCompetitor) * 100);
              }

              return (
                <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="py-4 px-6 align-middle">
                    <div className="font-bold text-gray-900 text-sm line-clamp-2 leading-relaxed" title={product.name}>
                      {product.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium border border-gray-200">
                        {product.category_name}
                      </span>
                      {product.brand && (
                        <span className="text-[10px] font-bold text-blue-600">
                          {product.brand}
                        </span>
                      )}
                    </div>
                  </td>

                  {sortedAggregators.map((agg, idx) => (
                    <td key={agg} className="py-3 px-2 align-middle">
                      {getPriceCell(prices[agg], agg, minPrice, maxPrice, product.normalized_prices, showNormalized, idx === 0)}
                    </td>
                  ))}

                  <td className="py-4 px-6 text-center align-middle">
                    {getPositionBadge(product.our_position, priceDiff)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayProducts.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          Нет данных для отображения
        </div>
      )}
    </div>
  );
}
