import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Play, Filter, CheckCircle, XCircle, Clock } from 'lucide-react';
import RecommendationCard from '../components/RecommendationCard';
import AlgorithmVisualizer from '../components/AlgorithmVisualizer';
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
          <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
          <p className="text-gray-500 mt-1">AI-powered pricing recommendations to achieve TOP-1 position</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowVisualizer(!showVisualizer)}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            {showVisualizer ? 'Hide Visualizer' : 'Show Visualizer'}
          </button>
          <button
            onClick={handleRunAlgorithm}
            disabled={runningAlgorithm}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runningAlgorithm ? 'animate-spin' : ''}`} />
            {runningAlgorithm ? 'Running...' : 'Run Algorithm'}
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
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Total</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-amber-500" />
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </div>
          <p className="text-sm text-amber-600">Pending</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <p className="text-2xl font-bold text-emerald-600">{stats.applied}</p>
          </div>
          <p className="text-sm text-emerald-600">Applied</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <XCircle className="w-5 h-5 text-gray-500" />
            <p className="text-2xl font-bold text-gray-600">{stats.rejected}</p>
          </div>
          <p className="text-sm text-gray-500">Rejected</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-5 h-5 text-gray-400" />
        {[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'applied', label: 'Applied' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'lower', label: 'Lower Price' },
          { value: 'add', label: 'Add Product' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Recommendations Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            <RefreshCw className="w-8 h-8 text-emerald-500" />
          </motion.div>
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-500">No recommendations found</p>
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
