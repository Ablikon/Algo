import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, RefreshCw, Download } from 'lucide-react';
import ComparisonTable from '../components/ComparisonTable';
import { productsAPI, categoriesAPI } from '../services/api';

export default function Comparison() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productsAPI.getComparison(),
        categoriesAPI.getAll(),
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category_name === selectedCategory;
    const matchesPosition =
      filterPosition === 'all' ||
      (filterPosition === 'top' && product.our_position === 1) ||
      (filterPosition === 'need_action' && product.our_position !== null && product.our_position > 1) ||
      (filterPosition === 'missing' && product.our_position === null);

    return matchesSearch && matchesCategory && matchesPosition;
  });

  const stats = {
    total: filteredProducts.length,
    top1: filteredProducts.filter((p) => p.our_position === 1).length,
    needAction: filteredProducts.filter((p) => p.our_position !== null && p.our_position > 1).length,
    missing: filteredProducts.filter((p) => p.our_position === null).length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Comparison</h1>
          <p className="text-gray-500 mt-1">Compare prices across all aggregators</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Position Filter */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All', count: stats.total },
              { value: 'top', label: 'TOP 1', count: stats.top1, color: 'emerald' },
              { value: 'need_action', label: 'Need Action', count: stats.needAction, color: 'amber' },
              { value: 'missing', label: 'Missing', count: stats.missing, color: 'rose' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterPosition(filter.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filterPosition === filter.value
                    ? filter.color
                      ? `bg-${filter.color}-100 text-${filter.color}-700 border border-${filter.color}-200`
                      : 'bg-gray-900 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {filter.label}
                <span className={`ml-2 ${
                  filterPosition === filter.value ? 'opacity-80' : 'text-gray-400'
                }`}>
                  ({filter.count})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center"
        >
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Total Products</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center"
        >
          <p className="text-2xl font-bold text-emerald-600">{stats.top1}</p>
          <p className="text-sm text-emerald-600">TOP 1 Position</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center"
        >
          <p className="text-2xl font-bold text-amber-600">{stats.needAction}</p>
          <p className="text-sm text-amber-600">Need Action</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-rose-50 rounded-xl p-4 border border-rose-100 text-center"
        >
          <p className="text-2xl font-bold text-rose-600">{stats.missing}</p>
          <p className="text-sm text-rose-600">Missing Products</p>
        </motion.div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            <RefreshCw className="w-8 h-8 text-emerald-500" />
          </motion.div>
        </div>
      ) : (
        <ComparisonTable products={filteredProducts} />
      )}
    </div>
  );
}
