import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { analyticsAPI, productsAPI } from '../services/api';

export default function Analytics() {
  const [gaps, setGaps] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gapsRes, productsRes] = await Promise.all([
        analyticsAPI.getGaps(),
        productsAPI.getComparison(),
      ]);
      setGaps(gapsRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const priceComparisonData = products.slice(0, 8).map((p) => ({
    name: p.name.split(' ')[0],
    glovo: p.prices?.glovo?.price || 0,
    yandex: p.prices?.yandex?.price || 0,
    wolt: p.prices?.wolt?.price || 0,
  }));

  const marketShareData = [
    { month: 'Jan', glovo: 28, yandex: 42, wolt: 30 },
    { month: 'Feb', glovo: 32, yandex: 40, wolt: 28 },
    { month: 'Mar', glovo: 35, yandex: 38, wolt: 27 },
    { month: 'Apr', glovo: 38, yandex: 36, wolt: 26 },
    { month: 'May', glovo: 42, yandex: 34, wolt: 24 },
    { month: 'Jun', glovo: 45, yandex: 32, wolt: 23 },
  ];

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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Deep insights into market positioning and opportunities</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Price Comparison Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Comparison by Product</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="glovo"
                  stackId="1"
                  stroke="#00A082"
                  fill="#00A082"
                  fillOpacity={0.6}
                  name="Glovo"
                />
                <Area
                  type="monotone"
                  dataKey="yandex"
                  stackId="2"
                  stroke="#FFCC00"
                  fill="#FFCC00"
                  fillOpacity={0.6}
                  name="Yandex"
                />
                <Area
                  type="monotone"
                  dataKey="wolt"
                  stackId="3"
                  stroke="#00C2E8"
                  fill="#00C2E8"
                  fillOpacity={0.6}
                  name="Wolt"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Market Share Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Share Trend (Projected)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marketShareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 60]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                  }}
                  formatter={(value) => `${value}%`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="glovo"
                  stroke="#00A082"
                  strokeWidth={3}
                  dot={{ fill: '#00A082' }}
                  name="Glovo"
                />
                <Line
                  type="monotone"
                  dataKey="yandex"
                  stroke="#FFCC00"
                  strokeWidth={3}
                  dot={{ fill: '#FFCC00' }}
                  name="Yandex"
                />
                <Line
                  type="monotone"
                  dataKey="wolt"
                  stroke="#00C2E8"
                  strokeWidth={3}
                  dot={{ fill: '#00C2E8' }}
                  name="Wolt"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Market Gaps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Market Gaps</h3>
              <p className="text-sm text-gray-500">Products missing from our catalog</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm font-medium">
            {gaps.length} gaps found
          </span>
        </div>

        {gaps.length === 0 ? (
          <div className="text-center py-12 bg-emerald-50 rounded-xl">
            <TrendingUp className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-emerald-700 font-medium">No market gaps!</p>
            <p className="text-emerald-600 text-sm">All competitor products are covered</p>
          </div>
        ) : (
          <div className="space-y-3">
            {gaps.map((gap, index) => (
              <motion.div
                key={gap.product_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-rose-500 rounded-full" />
                  <div>
                    <p className="font-medium text-gray-900">{gap.product_name}</p>
                    <p className="text-sm text-gray-500">{gap.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Competitor Min</p>
                    <p className="font-semibold text-gray-900">{gap.min_competitor_price}₸</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Suggested Price</p>
                    <p className="font-semibold text-emerald-600">{gap.suggested_price}₸</p>
                  </div>
                  <button className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl text-sm font-medium transition-colors">
                    Add Product
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
