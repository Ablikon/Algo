import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package,
  Trophy,
  AlertTriangle,
  ShoppingCart,
  Lightbulb,
  Target,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Award
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import StatsCard from '../components/StatsCard';
import ComparisonTable from '../components/ComparisonTable';
import { analyticsAPI, productsAPI } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useCity } from '../contexts/CityContext';

function HorseIcon(props) {
  return (
    <svg
      width={24}
      height={24}
      fill="none"
      stroke="#10b981"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M20 16v-2a4 4 0 0 0-4-4H7.5a3.5 3.5 0 0 0 0 7H9" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-1" />
      <path d="M8 20v-2" />
      <path d="M12 20v-2" />
      <path d="M20 8V6a2 2 0 0 0-2-2h-2.5a2 2 0 0 0-1.7.9l-3.8 5.7" />
      <path d="M8 14v-2" />
      <circle cx="16" cy="8" r="1" />
    </svg>
  );
}

const aggregatorColors = {
  glovo: '#00A082',
  yandex: '#FFCC00',
  wolt: '#00C2E8',
  magnum: '#EE1C25',
  'airba fresh': '#78B833',
  arbuz: '#FF7F00',
  'yandex lavka': '#FFCC00',
};

export default function Dashboard() {
  const { t } = useLanguage();
  const { refreshKey } = useCity();
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [refreshKey]); // Refetch when city changes

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
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="skeleton h-8 w-32 mb-2" />
            <div className="skeleton h-4 w-64" />
          </div>
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>

        {/* Stats Grid skeleton */}
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

        {/* Second row skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="skeleton h-4 w-28 mb-3" />
                  <div className="skeleton h-8 w-20 mb-2" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton h-12 w-12 rounded-xl" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="skeleton h-6 w-48 mb-4" />
            <div className="skeleton h-64 w-full" />
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="skeleton h-6 w-52 mb-4" />
            <div className="skeleton h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const pieData = [
    { name: 'TOP 1', value: stats?.products_at_top || 0, color: '#10b981' },
    { name: 'Need Action', value: stats?.products_need_action || 0, color: '#f59e0b' },
    { name: 'Missing', value: stats?.missing_products || 0, color: '#ef4444' },
  ];

  const barData = [
    { name: 'Glovo', coverage: stats?.market_coverage || 0 },
    { name: 'Yandex', coverage: 95 },
    { name: 'Wolt', coverage: 88 },
  ];

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Всего товаров"
          value={stats?.total_products || 0}
          subtitle="В ассортименте магазина"
          icon={Package}
          color="blue"
        />
        <StatsCard
          title="Позиция ТОП-1"
          value={stats?.products_at_top || 0}
          subtitle={`${stats?.price_competitiveness || 0}% каталога`}
          icon={Trophy}
          color="emerald"
        />
        <StatsCard
          title="Охват рынка"
          value={`${stats?.market_coverage || 0}%`}
          subtitle="Товары в наличии"
          icon={Target}
          color="blue"
        />
        <StatsCard
          title="Конкурентность"
          value={`${stats?.price_competitiveness || 0}%`}
          subtitle="Доля лучших цен"
          icon={TrendingUp}
          color="emerald"
        />
      </div>

      {/* Detail Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatsCard
          title="Ниже конкурентов"
          value={stats?.products_at_top || 0}
          subtitle="Лучшее предложение"
          icon={Award}
          color="emerald"
        />
        <StatsCard
          title="Выше конкурентов"
          value={stats?.products_need_action || 0}
          subtitle="Потенциал оптимизации"
          icon={AlertTriangle}
          color="amber"
        />
        <StatsCard
          title="Только у конкурентов"
          value={stats?.missing_products || 0}
          subtitle="Упущенный ассортимент"
          icon={ShoppingCart}
          color="rose"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Market Positioning Pie Chart */}
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
                  ]}
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
                <Legend iconType="circle" verticalAlign="middle" align="right" layout="vertical" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aggregator Coverage Bars */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Охват цен конкурентов</h3>
          <div className="space-y-4">
            {Object.entries(stats?.aggregator_stats || {}).map(([name, data]) => (
              <div key={name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: aggregatorColors[name.toLowerCase()] || '#94a3b8' }} />
                    <span className="capitalize">{name}</span>
                  </span>
                  <span className="text-gray-500 font-medium">{data.percent}% <span className="text-[10px] opacity-60">({data.count})</span></span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${data.percent}%`,
                      backgroundColor: aggregatorColors[name.toLowerCase()] || '#94a3b8'
                    }}
                  />
                </div>
              </div>
            ))}
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

