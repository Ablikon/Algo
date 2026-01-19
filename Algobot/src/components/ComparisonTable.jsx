import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react';

const aggregatorColors = {
  glovo: '#00A082',
  yandex: '#FFCC00',
  wolt: '#00C2E8',
};

export default function ComparisonTable({ products, compact = false }) {
  const getPositionBadge = (position) => {
    if (position === null) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
          <Minus className="w-3 h-3" />
          Нет
        </span>
      );
    }
    if (position === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          ТОП 1
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
        <AlertTriangle className="w-3 h-3" />
        №{position}
      </span>
    );
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `${price.toLocaleString()}₸`;
  };

  const getPriceCell = (price, isAvailable, aggregator, minPrice) => {
    if (!isAvailable || price === null) {
      return (
        <div className="flex items-center gap-2 text-gray-400">
          <XCircle className="w-4 h-4" />
          <span>Нет в наличии</span>
        </div>
      );
    }

    const isMin = price === minPrice;
    const isGlovo = aggregator === 'glovo';

    return (
      <div className={`font-semibold ${isMin ? 'text-emerald-600' : isGlovo ? 'text-gray-900' : 'text-gray-600'}`}>
        {formatPrice(price)}
        {isMin && <span className="ml-2 text-xs text-emerald-500">МИН</span>}
      </div>
    );
  };

  const displayProducts = compact ? products.slice(0, 5) : products;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Товар</th>
              <th className="text-center py-4 px-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: aggregatorColors.glovo }} />
                  <span className="text-sm font-semibold text-gray-600">Glovo</span>
                </div>
              </th>
              <th className="text-center py-4 px-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: aggregatorColors.yandex }} />
                  <span className="text-sm font-semibold text-gray-600">Yandex</span>
                </div>
              </th>
              <th className="text-center py-4 px-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: aggregatorColors.wolt }} />
                  <span className="text-sm font-semibold text-gray-600">Wolt</span>
                </div>
              </th>
              <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600">Наша позиция</th>
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
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.category_name}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getPriceCell(glovoPrice, prices.glovo?.is_available, 'glovo', minPrice)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getPriceCell(yandexPrice, prices.yandex?.is_available, 'yandex', minPrice)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getPriceCell(woltPrice, prices.wolt?.is_available, 'wolt', minPrice)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {getPositionBadge(product.our_position)}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
