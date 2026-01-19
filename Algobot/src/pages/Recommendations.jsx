import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Play, Filter, CheckCircle, XCircle, Clock } from 'lucide-react';
import RecommendationCard from '../components/RecommendationCard';
import AlgorithmVisualizer from '../components/AlgorithmVisualizer';
import { NoRecommendations } from '../components/EmptyState';
import { recommendationsAPI, algorithmAPI } from '../services/api';

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [runningAlgorithm, setRunningAlgorithm] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await recommendationsAPI.getAll();
      setRecommendations(res.data);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (id) => {
    setApplyingId(id);
    try {
      await recommendationsAPI.apply(id);
      setRecommendations((prev) =>
        prev.map((rec) =>
          rec.id === id ? { ...rec, status: 'APPLIED' } : rec
        )
      );
    } catch (error) {
      console.error('Error applying recommendation:', error);
    } finally {
      setApplyingId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      await recommendationsAPI.reject(id);
      setRecommendations((prev) =>
        prev.map((rec) =>
          rec.id === id ? { ...rec, status: 'REJECTED' } : rec
        )
      );
    } catch (error) {
      console.error('Error rejecting recommendation:', error);
    }
  };

  const handleRunAlgorithm = async () => {
    setRunningAlgorithm(true);
    try {
      const res = await algorithmAPI.run();
      if (res.data.new_recommendations > 0) {
        await fetchRecommendations();
      }
    } catch (error) {
      console.error('Error running algorithm:', error);
    } finally {
      setRunningAlgorithm(false);
    }
  };

  const filteredRecommendations = recommendations.filter((rec) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return rec.status === 'PENDING';
    if (filter === 'applied') return rec.status === 'APPLIED';
    if (filter === 'rejected') return rec.status === 'REJECTED';
    if (filter === 'lower') return rec.action_type === 'LOWER_PRICE';
    if (filter === 'add') return rec.action_type === 'ADD_PRODUCT';
    return true;
  });

  const stats = {
    total: recommendations.length,
    pending: recommendations.filter((r) => r.status === 'PENDING').length,
    applied: recommendations.filter((r) => r.status === 'APPLIED').length,
    rejected: recommendations.filter((r) => r.status === 'REJECTED').length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Рекомендации</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">AI-рекомендации по ценообразованию для достижения ТОП-1</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowVisualizer(!showVisualizer)}
            className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            {showVisualizer ? 'Скрыть визуализацию' : 'Показать визуализацию'}
          </button>
          <button
            onClick={handleRunAlgorithm}
            disabled={runningAlgorithm}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runningAlgorithm ? 'animate-spin' : ''}`} />
            {runningAlgorithm ? 'Выполняется...' : 'Запустить алгоритм'}
          </button>
        </div>
      </div>

      {/* Algorithm Visualizer */}
      {showVisualizer && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-8"
        >
          <AlgorithmVisualizer />
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Всего</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 border border-amber-100 dark:border-amber-800 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-400">В ожидании</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.applied}</p>
          </div>
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Применено</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 border border-gray-200 dark:border-slate-600 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{stats.rejected}</p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Отклонено</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-5 h-5 text-gray-400" />
        {[
          { value: 'all', label: 'Все' },
          { value: 'pending', label: 'В ожидании' },
          { value: 'applied', label: 'Применено' },
          { value: 'rejected', label: 'Отклонено' },
          { value: 'lower', label: 'Сниженная цена' },
          { value: 'add', label: 'Добавить продукт' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f.value
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Recommendations Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="skeleton h-5 w-32" />
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
              <div className="skeleton h-4 w-24 mb-2" />
              <div className="flex justify-between items-center mb-4">
                <div className="skeleton h-8 w-20" />
                <div className="skeleton h-4 w-8" />
                <div className="skeleton h-8 w-20" />
              </div>
              <div className="skeleton h-3 w-full mb-4" />
              <div className="flex gap-2">
                <div className="skeleton h-10 flex-1 rounded-xl" />
                <div className="skeleton h-10 flex-1 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
          <NoRecommendations />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecommendations.map((rec, index) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <RecommendationCard
                recommendation={rec}
                onApply={handleApply}
                onReject={handleReject}
                isApplying={applyingId === rec.id}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
