import { Scale, ExternalLink } from 'lucide-react';

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

  const getPositionBadge = (position) => {
    if (position === null) {
      return (
        <span className="text-gray-300 text-sm">—</span>
      );
    }

    const bgColor = position === 1
      ? 'bg-emerald-500'
      : position <= 3
        ? 'bg-amber-500'
        : 'bg-gray-400';

    return (
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-white text-sm font-bold`}>
        {position}
      </div>
    );
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `${Math.round(price).toLocaleString()} ₸`;
  };

  const getPriceCell = (priceData, aggregator, minPrice, normalizedData, showNormalized, isOurCompany) => {
    if (!priceData || !priceData.is_available || priceData.price === null) {
      return (
        <div className="text-center text-gray-300">—</div>
      );
    }

    const price = priceData.price;
    const isMin = price === minPrice;
    const hasUrl = priceData.url;
    const normalizedPrice = normalizedData?.[aggregator]?.price_per_unit;
    const normalizedUnit = normalizedData?.[aggregator]?.unit;

    let textColor = "text-gray-700";
    if (isMin) {
      textColor = "text-emerald-600 font-bold";
    } else if (isOurCompany) {
      textColor = "text-blue-600";
    }

    const priceContent = (
      <>
        <span className={`text-sm ${textColor}`}>
          {formatPrice(price)}
        </span>
        {showNormalized && normalizedPrice && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            {formatPrice(normalizedPrice)}/{normalizedUnit}
          </div>
        )}
      </>
    );

    if (hasUrl) {
      return (
        <a
          href={priceData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center hover:opacity-70 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {priceContent}
          <ExternalLink className="w-3 h-3 text-gray-400 mt-0.5" />
        </a>
      );
    }

    return <div className="text-center">{priceContent}</div>;
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

              return (
                <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-6 align-middle">
                    <div className="font-medium text-gray-900 text-sm line-clamp-2" title={product.name}>
                      {product.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500">
                        {product.category_name}
                      </span>
                      {product.brand && (
                        <span className="text-[10px] text-blue-600 font-medium">
                          {product.brand}
                        </span>
                      )}
                    </div>
                  </td>

                  {sortedAggregators.map((agg, index) => (
                    <td key={agg} className="py-3 px-2 align-middle">
                      {getPriceCell(prices[agg], agg, minPrice, product.normalized_prices, showNormalized, index === 0)}
                    </td>
                  ))}

                  <td className="py-3 px-6 text-center align-middle">
                    {getPositionBadge(product.our_position)}
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
