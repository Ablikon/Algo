import { Scale, ExternalLink, Trophy, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

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
    ? availableAggregators.map(a => a.name)
    : Array.from(new Set(products.flatMap(p => Object.keys(p.prices || {})))).filter(name => name !== 'our_company');

  // Business Logic: Get Semantic Verdict
  const getVerdict = (product, minPrice) => {
    // Find our company price - checking for is_our_company flag in prices
    let ourPriceVal = null;
    Object.values(product.prices || {}).forEach(p => {
      if (p.is_our_company) ourPriceVal = p.price;
    });

    if (!ourPriceVal) return { type: 'missing', text: 'Нет цены', color: 'gray' };
    if (!minPrice) return { type: 'exclusive', text: 'Эксклюзив', color: 'blue' };

    if (ourPriceVal === minPrice) {
      return { type: 'success', text: 'Лучшая цена', color: 'emerald' };
    }

    if (ourPriceVal > minPrice) {
      const diffPercent = Math.round(((ourPriceVal - minPrice) / minPrice) * 100);
      return { type: 'warning', text: `Дороже на ${diffPercent}%`, color: 'rose' };
    }

    return { type: 'neutral', text: 'Ок', color: 'gray' };
  };

  const getVerdictBadge = (verdict) => {
    switch (verdict.type) {
      case 'success':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-bold whitespace-nowrap">{verdict.text}</span>
          </div>
        );
      case 'warning':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold whitespace-nowrap">{verdict.text}</span>
          </div>
        );
      case 'exclusive':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
            <Trophy className="w-4 h-4" />
            <span className="text-xs font-bold whitespace-nowrap">{verdict.text}</span>
          </div>
        );
      default: // missing or neutral
        return (
          <span className="text-gray-400 text-xs font-medium">{verdict.text}</span>
        );
    }
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `${Math.round(price).toLocaleString()} ₸`;
  };

  const getPriceCell = (priceData, aggregator, minPrice, normalizedData, showNormalized) => {
    if (!priceData || !priceData.is_available || priceData.price === null) {
      return (
        <div className="text-center text-gray-300">—</div>
      );
    }

    const price = priceData.price;
    const isMin = price === minPrice;
    const hasUrl = priceData.external_url;
    const isOurCompany = priceData.is_our_company;
    const normalizedPrice = normalizedData?.[aggregator]?.price_per_unit;
    const normalizedUnit = normalizedData?.[aggregator]?.unit;

    // Logic: Highlight Winner (Min Price)
    let textColor = "text-gray-500";
    let fontWeight = "font-normal";
    let badge = null;

    if (isMin) {
      textColor = "text-emerald-700";
      fontWeight = "font-bold";
    } else if (isOurCompany) {
      textColor = "text-gray-900";
      fontWeight = "font-medium";
    }

    const priceContent = (
      <div className="flex flex-col items-center">
        <div className="flex items-center">
          <span className={`text-sm ${textColor} ${fontWeight}`}>
            {formatPrice(price)}
          </span>
          {badge}
        </div>

        {showNormalized && normalizedPrice && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            {formatPrice(normalizedPrice)}/{normalizedUnit}
          </div>
        )}
      </div>
    );

    if (hasUrl) {
      return (
        <a
          href={hasUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center hover:opacity-70 transition-opacity group"
          onClick={(e) => e.stopPropagation()}
        >
          {priceContent}
          <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      );
    }

    return <div className="text-center">{priceContent}</div>;
  };

  const displayProducts = compact ? products.slice(0, 5) : products;

  // Use exact names for sorting
  const defaultOrder = ['Glovo', 'Magnum', 'Wolt', 'Yandex Lavka', 'Airba Fresh', 'Arbuz.kz'];

  const sortedAggregators = [
    ...defaultOrder.filter(name => allAggregatorNames.includes(name)),
    ...allAggregatorNames.filter(name => !defaultOrder.includes(name))
  ];

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

              <th className="py-4 px-6 text-center text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[160px]">
                Вердикт
              </th>

              {sortedAggregators.map((agg, idx) => {
                // Find aggregator metadata if available
                const aggMeta = availableAggregators.find(a => a.name === agg);
                const color = aggMeta?.color || aggregatorColors[agg.toLowerCase()] || '#cbd5e1';
                const isOur = aggMeta?.is_our_company;

                return (
                  <th key={agg} className="py-4 px-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <span>{isOur ? 'Наши Цены' : agg}</span>
                      <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayProducts.map((product) => {
              const prices = product.prices || {};
              const priceValues = sortedAggregators.map(agg => prices[agg]?.price).filter(p => p !== null && p !== undefined);
              const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;

              // Clean Brand Logic
              const showBrand = product.brand && !product.name.toLowerCase().startsWith(product.brand.toLowerCase());

              // Calculate Verdict
              const verdict = getVerdict(product, minPrice);

              return (
                <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-6 align-middle">
                    <div className="font-medium text-gray-900 text-sm line-clamp-2" title={product.name}>
                      {(() => {
                        const productUrl = Object.values(product.prices || {}).find(p => p.is_our_company)?.external_url
                          || Object.values(product.prices || {}).find(p => p.external_url)?.external_url;

                        return productUrl ? (
                          <a href={productUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 flex items-center gap-1 group">
                            {product.name}
                            <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ) : (
                          product.name
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {product.category_name || product.category}
                      </span>
                      {showBrand && (
                        <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                          {product.brand}
                        </span>
                      )}
                      {product.country && (
                        <span className="text-[10px] text-purple-600 font-medium bg-purple-50 px-1.5 py-0.5 rounded">
                          {product.country}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Verdict Column - Moved to be Second for Visibility */}
                  <td className="py-3 px-6 text-center align-middle">
                    <div className="flex justify-center">
                      {getVerdictBadge(verdict)}
                    </div>
                  </td>

                  {sortedAggregators.map((agg, index) => (
                    <td key={agg} className="py-3 px-2 align-middle">
                      {getPriceCell(prices[agg], agg, minPrice, product.normalized_prices, showNormalized)}
                    </td>
                  ))}
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
