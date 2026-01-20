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
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
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
          title={t('totalProducts')}
          value={stats?.total_products || 0}
          subtitle={t('inAssortment')}
          icon={Package}
          color="blue"
        />
        <StatsCard
          title={t('top1Position')}
          value={stats?.products_at_top || 0}
          subtitle={`${stats?.price_competitiveness || 0}% ${t('ofCatalog')}`}
          icon={Trophy}
          color="emerald"
        />
        <StatsCard
          title={t('needAction')}
          value={stats?.products_need_action || 0}
          subtitle={t('priceAdjustment')}
          icon={AlertTriangle}
          color="amber"
        />
        <StatsCard
          title={t('missing')}
          value={stats?.missing_products || 0}
          subtitle={t('competitorsOnly')}
          icon={ShoppingCart}
          color="rose"
        />
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title={t('awaitingDecision')}
          value={stats?.pending_recommendations || 0}
          subtitle={t('awaitingActions')}
          icon={Lightbulb}
          color="purple"
        />
        <StatsCard
          title={t('potentialSavings')}
          value={`${stats?.potential_savings?.toLocaleString() || 0}₸`}
          subtitle={t('ifApplyAll')}
          icon={Award}
          color="emerald"
        />
        <StatsCard
          title={t('marketCoverage')}
          value={`${stats?.market_coverage || 0}%`}
          subtitle={t('inStock')}
          icon={Target}
          color="blue"
        />
        <StatsCard
          title={t('priceCompetitiveness')}
          value={`${stats?.price_competitiveness || 0}%`}
          subtitle={t('inTop1')}
          icon={TrendingUp}
          color="emerald"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pie Chart */}
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('statusDistribution')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Chart */}
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('marketCoverageComparison')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="coverage" fill="#10b981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
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

