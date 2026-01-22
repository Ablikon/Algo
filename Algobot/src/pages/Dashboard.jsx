import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package,
  Trophy,
  AlertTriangle,
  Snail,
  Lightbulb,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Award,
  Radar,
  Layers
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import StatsCard from '../components/StatsCard';
import ComparisonTable from '../components/ComparisonTable';
import { analyticsAPI, productsAPI } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useCity } from '../contexts/CityContext';

import glovoLogo from '../assets/glovo.jpeg';
import magnumLogo from '../assets/Magnum_Cash_&_Carry.png';
import woltLogo from '../assets/Wolt_id52_mlyiE_0.svg';
import airbaFreshLogo from '../assets/Airba Fresh_idYXu-d5px_1.svg';
import yandexLavkaLogo from '../assets/idq0QSew-z_1768990557463.png';
import arbuzLogo from '../assets/id-kqZgjke_1768990623965.jpeg';

const aggregatorColors = {
  glovo: '#00A082',
  yandex: '#FFCC00',
  wolt: '#00C2E8',
  magnum: '#EE1C25',
  'airba fresh': '#78B833',
  arbuz: '#FF7F00',
  'yandex lavka': '#FFCC00',
};

const aggregatorLogos = {
  glovo: glovoLogo,
  magnum: magnumLogo,
  wolt: woltLogo,
  'airba fresh': airbaFreshLogo,
  'yandex lavka': yandexLavkaLogo,
  arbuz: arbuzLogo,
  'arbuz.kz': arbuzLogo,
};

export default function Dashboard() {
  const { t } = useLanguage();
  const { refreshKey, currentCity, loading: cityLoading } = useCity();
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (cityLoading) return;
    fetchData();
  }, [refreshKey, currentCity?.slug, cityLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, productsRes] = await Promise.all([
        analyticsAPI.getDashboard(),
        productsAPI.getComparison({ page: 1, page_size: 10 }),
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data.results || productsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="skeleton h-8 w-32 mb-2" />
            <div className="skeleton h-4 w-64" />
          </div>
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="skeleton h-4 w-24 mb-3" />
                  <div className="skeleton h-8 w-16 mb-2" />
                  <div className="skeleton h-3 w-32" />
                </div>
                <div className="skeleton h-12 w-12 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboardTitle')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('dashboardSubtitle')}</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t('refresh')}
        </button>
      </div>

      {/* Main Stats Grid - Reordered: Leader, Higher, Missing, Total */}
      {(() => {
        const competitorsTotal = Object.values(stats?.aggregator_stats || {}).reduce((acc, curr) => acc + (curr.count || 0), 0);
        const ourTotal = (stats?.products_at_top || 0) + (stats?.products_need_action || 0);
        const displayTotal = ourTotal + competitorsTotal;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Лучшая цена"
              value={stats?.products_at_top || 0}
              subtitle={`${stats?.price_competitiveness || 0}% каталога`}
              icon={Trophy}
              color="emerald"
            />
            <StatsCard
              title="Выше конкурентов"
              value={stats?.products_need_action || 0}
              subtitle="Требуют коррекции"
              icon={AlertTriangle}
              color="amber"
            />
            <StatsCard
              title="Только у конкурентов"
              value={competitorsTotal}
              subtitle="Общий ассортимент"
              icon={Snail}
              color="rose"
            />
            <StatsCard
              title="Всего товаров"
              value={displayTotal}
              subtitle="В выборке магазина"
              icon={Package}
              color="blue"
            />
          </div>
        );
      })()}

      {/* Detail Stats Grid - Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">



      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Market Positioning Pie Chart - Forced Ordered Legend */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Позиционирование на рынке</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'ТОП-1 (Лидер)', value: stats?.products_at_top || 0 },
                    { name: 'Выше рынка', value: stats?.products_need_action || 0 },
                    { name: 'Упущено', value: stats?.missing_products || 0 },
                  ].filter(d => d.value >= 0)} // Keep zeros to maintain legend order
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#F59E0B" />
                  <Cell fill="#F43F5E" />
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  content={({ payload }) => {
                    const orderMap = { 'ТОП-1 (Лидер)': 1, 'Выше рынка': 2, 'Упущено': 3 };
                    const sortedPayload = [...payload].sort((a, b) =>
                      (orderMap[a.value] || 99) - (orderMap[b.value] || 99)
                    );
                    return (
                      <ul className="flex flex-col gap-2 ml-4">
                        {sortedPayload.map((entry, index) => (
                          <li key={`item-${index}`} className="flex items-center gap-2 text-sm">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-600 dark:text-gray-400 font-medium">{entry.value}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aggregator Live Status Grid */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Активные источники</h3>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Live Updating</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {['Glovo', 'Magnum', 'Wolt', 'Airba Fresh', 'Yandex Lavka', 'Arbuz.kz'].map((name) => {
              const normalizedName = name.toLowerCase().replace('.kz', '');
              const isGlovo = normalizedName === 'glovo';

              const aggStats = stats?.aggregator_stats?.[name] || stats?.aggregator_stats?.[name.replace('.kz', '')];
              const isOnline = isGlovo ? !!stats : !!aggStats;

              // Only count products we actually have (at top price or needing action)
              const count = isGlovo
                ? ((stats?.products_at_top || 0) + (stats?.products_need_action || 0))
                : (aggStats?.count || 0);

              return (
                <div
                  key={name}
                  className={`
                    flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200
                    ${isOnline
                      ? 'bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-white'
                      : 'bg-transparent opacity-40 grayscale'
                    }
                  `}
                >
                  {/* Icon Container */}
                  <div className="mb-3">
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden
                      ${isOnline ? 'bg-white shadow-sm' : 'bg-gray-100 dark:bg-slate-800'}
                    `}>
                      {aggregatorLogos[normalizedName] ? (
                        <img
                          src={aggregatorLogos[normalizedName]}
                          alt={name}
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: aggregatorColors[normalizedName] || '#cbd5e1' }}>
                          {name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Name */}
                  <span className="text-sm font-semibold text-center mb-0.5 whitespace-nowrap">
                    {name}
                  </span>

                  {/* Product Count */}
                  {isOnline ? (
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {count.toLocaleString()} товаров
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      Нет данных
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Price Comparison Preview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('priceComparison')}</h3>
          <Link
            to="/comparison"
            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium text-sm"
          >
            {t('viewAll')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <ComparisonTable products={products} compact />
      </div>
    </div>
  );
}
