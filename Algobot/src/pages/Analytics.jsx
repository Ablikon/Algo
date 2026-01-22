import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, TrendingUp, AlertCircle, ArrowRight, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import { analyticsAPI, productsAPI } from '../services/api';
import { useCity } from '../contexts/CityContext';

const aggregatorColors = {
  glovo: '#00A082',
  magnum: '#EE1C25',
  wolt: '#00C2E8',
  'airba fresh': '#78B833',
  'yandex lavka': '#FFCC00',
  arbuz: '#FF7F00',
};

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { refreshKey, currentCity, loading: cityLoading } = useCity();

  useEffect(() => {
    if (cityLoading) return;
    fetchData();
  }, [refreshKey, currentCity?.slug, cityLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, gapsRes, productsRes] = await Promise.all([
        analyticsAPI.getDashboard(),
        analyticsAPI.getGaps(),
        // Fetch more items and filter for those with competition to make the chart fuller
        productsAPI.getComparison({ page: 1, page_size: 50 }),
      ]);
      setStats(statsRes.data);
      setGaps(gapsRes.data.results || gapsRes.data);

      // Filter for products that have at least one competitor price
      const allProds = productsRes.data.results || productsRes.data;
      const sortedProds = [...allProds]
        .sort((a, b) => Object.keys(b.prices || {}).length - Object.keys(a.prices || {}).length)
        .slice(0, 5);

      setProducts(sortedProds);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Price Comparison Data
  const priceBenchmarkingData = products.map((p) => {
    const entry = { name: p.name.length > 35 ? p.name.substring(0, 32) + '...' : p.name };
    Object.entries(p.prices || {}).forEach(([name, data]) => {
      if (data.price) {
        entry[name] = data.price;
      }
    });
    return entry;
  });

  const activeAggregators = Array.from(new Set(products.flatMap(p => Object.keys(p.prices || {}))));

  // 2. Market Overlap Data
  const totalOurProducts = (stats?.products_at_top || 0) + (stats?.products_need_action || 0);
  const overlapData = stats?.aggregator_stats ? Object.entries(stats.aggregator_stats).map(([name, data]) => ({
    name,
    value: data.overlap_count || 0,
    color: aggregatorColors[name.toLowerCase().replace('.kz', '')] || '#cbd5e1',
  })).sort((a, b) => b.value - a.value) : [];

  const gridColor = '#f1f5f9';
  const textColor = '#94a3b8';

  const formatPrice = (value) => `${value?.toLocaleString()} ₸`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-gray-500 font-medium italic">Загрузка аналитики...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Аналитика рынка</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Детальный разбор ценовых позиций</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl font-medium transition-all shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Chart 1: Price Benchmarking */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700 h-[520px] flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Сравнение цен</h3>
              <p className="text-sm text-gray-500">Прямое сопоставление (Топ-5 товаров)</p>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={priceBenchmarkingData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: textColor }}
                  tickFormatter={(val) => `${val}₸`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                  width={140}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  formatter={(val, name) => [formatPrice(val), name]}
                />
                <Legend
                  iconType="circle"
                  verticalAlign="top"
                  align="right"
                  height={36}
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '14px' }}
                />
                {activeAggregators.map(agg => (
                  <Bar
                    key={agg}
                    dataKey={agg}
                    name={agg}
                    fill={aggregatorColors[agg.toLowerCase().replace('.kz', '')] || '#cbd5e1'}
                    radius={[0, 4, 4, 0]}
                    barSize={8}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Chart 2: Market Overlap */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700 h-[520px] flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Пересечение рынка</h3>
              <p className="text-sm text-gray-500">Кто ваш главный конкурент</p>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={overlapData} margin={{ top: 5, right: 60, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#475569' }} width={110} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val) => [`${val} тов.`, 'Общих товаров']}
                />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={28}>
                  {overlapData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                График показывает, сколько ваших товаров (из {totalOurProducts}) также есть у конкурентов.
                Чем больше пересечение, тем выше конкуренция за покупателя.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Market Gaps (Uncovered Products) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/40 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Упущенные позиции</h3>
              <p className="text-sm text-gray-500">Товары, которых нет в вашем ассортименте</p>
            </div>
          </div>
          <span className="px-4 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-sm font-bold rounded-full">
            {gaps.length} товаров не покрыто
          </span>
        </div>

        {gaps.length === 0 ? (
          <div className="text-center py-20 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-dashed border-emerald-200">
            <TrendingUp className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h4 className="text-xl font-bold text-emerald-800 dark:text-emerald-400">Полное покрытие!</h4>
            <p className="text-emerald-600 dark:text-emerald-500 max-w-xs mx-auto mt-2">Весь отслеживаемый ассортимент конкурентов уже есть в вашем магазине.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gaps.slice(0, 10).map((gap, index) => (
              <motion.div
                key={gap.product_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 border border-transparent hover:border-rose-100 dark:hover:border-rose-900 rounded-2xl p-5 transition-all"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-bold text-gray-900 dark:text-white truncate" title={gap.product_name}>{gap.product_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase text-gray-400">{gap.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">У них</p>
                    <p className="font-black text-gray-900 dark:text-white">{gap.min_competitor_price} ₸</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center shadow-sm">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-500 uppercase font-bold">Совет</p>
                    <p className="font-black text-emerald-600">{gap.suggested_price} ₸</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {gaps.length > 10 && (
          <div className="mt-8 text-center text-sm text-gray-400 italic">
            Показано первые 10 товаров из {gaps.length}. Проверьте раздел "База данных" для полного списка.
          </div>
        )}
      </motion.div>
    </div>
  );
}
