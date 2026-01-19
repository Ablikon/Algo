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
  RefreshCw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import StatsCard from '../components/StatsCard';
import ComparisonTable from '../components/ComparisonTable';
import { analyticsAPI, productsAPI } from '../services/api';

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
      <path d="M20 16v-2a4 4 0 0 0-4-4H7.5a3.5 3.5 0 0 0 0 7H9"/>
      <path d="M20 16v2a2 2 0 0 1-2 2h-1"/>
      <path d="M8 20v-2"/>
      <path d="M12 20v-2"/>
      <path d="M20 8V6a2 2 0 0 0-2-2h-2.5a2 2 0 0 0-1.7.9l-3.8 5.7"/>
      <path d="M8 14v-2"/>
      <circle cx="16" cy="8" r="1"/>
    </svg>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, productsRes] = await Promise.all([
        analyticsAPI.getDashboard(),
        productsAPI.getComparison(),
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <RefreshCw className="w-8 h-8 text-emerald-500" />
        </motion.div>
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
          <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
          <p className="text-gray-500 mt-1">Следите за своей позицией на рынке в реальном времени</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Всего товаров"
          value={stats?.total_products || 0}
          subtitle="В ассортименте"
          icon={Package}
          color="blue"
        />
        <StatsCard
          title="Позиция ТОП 1"
          value={stats?.products_at_top || 0}
          subtitle={`${stats?.price_competitiveness || 0}% нашего каталога`}
          icon={Trophy}
          color="emerald"
        />
        <StatsCard
          title="Требуют действий"
          value={stats?.products_need_action || 0}
          subtitle="Нужна корректировка цены"
          icon={AlertTriangle}
          color="amber"
        />
        <StatsCard
          title="Отсутствуют"
          value={stats?.missing_products || 0}
          subtitle="Только у конкурентов"
          icon={ShoppingCart}
          color="rose"
        />
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Ожидают решения"
          value={stats?.pending_recommendations || 0}
          subtitle="Ожидают действий"
          icon={Lightbulb}
          color="purple"
        />
        <StatsCard
          title="Потенциальная экономия"
          value={`${stats?.potential_savings?.toLocaleString() || 0}₸`}
          subtitle="Если применить все"
          icon={HorseIcon}
          color="emerald"
        />
        <StatsCard
          title="Покрытие рынка"
          value={`${stats?.market_coverage || 0}%`}
          subtitle="Товаров в наличии"
          icon={Target}
          color="blue"
        />
        <StatsCard
          title="Ценовая конкурентность"
          value={`${stats?.price_competitiveness || 0}%`}
          subtitle="В позиции ТОП 1"
          icon={TrendingUp}
          color="emerald"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Распределение статусов товаров</h3>
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
                <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Сравнение покрытия рынка</h3>
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
        </motion.div>
      </div>

      {/* Price Comparison Preview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Сравнение цен</h3>
          <Link
            to="/comparison"
            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium text-sm"
          >
            Смотреть все <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <ComparisonTable products={products} compact />
      </div>
    </div>
  );
}
