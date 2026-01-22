import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, TrendingUp, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';
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
import MatchingProgressBar from '../components/MatchingProgressBar';
import { analyticsAPI, productsAPI } from '../services/api';
import { useCity } from '../contexts/CityContext';

const aggregatorColors = {
  glovo: '#00A082',
  magnum: '#EE1C25',
  wolt: '#00C2E8',
  'airba fresh': '#78B833',
  'yandex lavka': '#FFCC00',
  arbuz: '#FF7F00',
  kaspi: '#F14635',
};

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const { refreshKey, currentCity, loading: cityLoading } = useCity();

  useEffect(() => {
    if (cityLoading) return;
    fetchData();
  }, [refreshKey, currentCity?.slug, cityLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, gapsRes] = await Promise.all([
        analyticsAPI.getDashboard(),
        analyticsAPI.getGaps({ page_size: 5 })
      ]);
      setStats(statsRes.data);
      setGaps(gapsRes.data.results || []);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };


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

      <MatchingProgressBar />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-8 mb-10">
        {/* Chart 1: Price Index */}
        {/* Chart 1: Market Gaps (Assortment Opportunities) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700"
        >
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/40 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Упущенные возможности</h3>
                <p className="text-sm text-gray-500">Товары, которые есть у конкурентов, но нет у вас</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl">
              <p className="text-xs text-cyan-700 dark:text-cyan-400 font-semibold">ТОП-5 по популярности</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-cyan-50/50 dark:bg-cyan-900/10 rounded-2xl border border-cyan-100 dark:border-cyan-900/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-cyan-700 dark:text-cyan-400 leading-relaxed">
                <span className="font-bold">Анализ пробелов:</span> Здесь собраны товары, которые представлены у большинства ваших конкурентов.
                Добавление этих позиций поможет увеличить ваш охват и привлечь новых покупателей.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300">Товар</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300">Категория</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300">Популярность</th>
                  <th className="text-right py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300">Мин. цена</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm max-w-[300px] truncate">
                        {item.product_name}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-500 dark:text-gray-400">
                      {item.category || '—'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400 font-bold text-xs">
                        {item.competitor_count} агрегаторов
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {item.min_competitor_price.toLocaleString()} ₸
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {gaps.length === 0 && (
            <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-3">
              <ShoppingBag className="w-8 h-8 opacity-20" />
              <p>Нет пропущенных товаров для отображения</p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button className="flex items-center gap-2 text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 font-bold text-sm transition-colors group">
              Смотреть все предложения
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* Chart 2: Market Overlap */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700"
        >
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Пересечение ассортимента</h3>
                <p className="text-sm text-gray-500">Сколько ваших товаров есть у каждого конкурента</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold">Из {totalOurProducts} товаров</p>
            </div>
          </div>

          <div className="mb-4 p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                <span className="font-bold">Что означает график:</span> показывает, какая часть вашего ассортимента дублируется у конкурентов.
                Чем больше пересечение — тем сильнее конкуренция за одних и тех же покупателей.
              </p>
            </div>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={overlapData} margin={{ top: 5, right: 60, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: textColor }}
                  label={{ value: 'Количество общих товаров', position: 'insideBottom', offset: -5, fontSize: 11, fill: textColor }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 13, fontWeight: 600, fill: '#475569' }}
                  width={130}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                  formatter={(val) => [`${val} товаров`, 'Пересечение']}
                />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={32}>
                  {overlapData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Insights Section */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1">Лидер конкуренции</p>
              <p className="text-lg font-black text-emerald-900 dark:text-emerald-300">
                {overlapData[0]?.name || '—'}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">
                {overlapData[0]?.value || 0} общих позиций
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Средний уровень</p>
              <p className="text-lg font-black text-blue-900 dark:text-blue-300">
                {overlapData.length > 0 ? Math.round(overlapData.reduce((sum, d) => sum + d.value, 0) / overlapData.length) : 0}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-500 mt-1">
                товаров на конкурента
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-900/10 rounded-2xl p-4 border border-purple-200 dark:border-purple-800">
              <p className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase mb-1">Уникальность</p>
              <p className="text-lg font-black text-purple-900 dark:text-purple-300">
                {overlapData.length > 0 && totalOurProducts > 0
                  ? Math.round(((totalOurProducts - (overlapData.reduce((sum, d) => sum + d.value, 0) / overlapData.length)) / totalOurProducts) * 100)
                  : 0}%
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-500 mt-1">
                эксклюзивных товаров
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}