import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Search, Filter, RefreshCw, Download, ChevronDown, X } from 'lucide-react';
import ComparisonTable from '../components/ComparisonTable';
import CategoryTree from '../components/CategoryTree';
import { productsAPI, categoriesAPI } from '../services/api';
import { useCity } from '../contexts/CityContext';

export default function Comparison() {
  const { refreshKey } = useCity();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filterPosition, setFilterPosition] = useState('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showNormalized, setShowNormalized] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [refreshKey]); // Refetch when city changes

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes, treeRes] = await Promise.all([
        productsAPI.getComparison(1, 200), // Get up to 200 products
        categoriesAPI.getAll(),
        categoriesAPI.getTree(),
      ]);
      // Handle paginated response
      setProducts(productsRes.data.results || productsRes.data);
      setCategories(categoriesRes.data);
      setCategoryTree(treeRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          productsAPI.getComparison(1, 200),
          categoriesAPI.getAll(),
        ]);
        setProducts(productsRes.data.results || productsRes.data);
        setCategories(categoriesRes.data);
        setCategoryTree(categoriesRes.data.map(c => ({ ...c, children: [] })));
      } catch (e) {
        console.error('Fallback also failed:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const getAllCategoryIds = (cats) => {
    const ids = [];
    const collect = (categories) => {
      categories.forEach(cat => {
        ids.push(cat.id);
        if (cat.children) collect(cat.children);
      });
    };
    collect(cats);
    return ids;
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category_id);
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

  const getSelectedCategoryNames = () => {
    if (selectedCategories.length === 0) return 'Все категории';
    if (selectedCategories.length === getAllCategoryIds(categoryTree).length) return 'Все категории';
    const names = categories.filter(c => selectedCategories.includes(c.id)).map(c => c.name);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Сравнение цен</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Сравните цены на всех агрегаторах</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl font-medium transition-colors">
            <Download className="w-4 h-4" />
            Экспорт
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск товаров..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* Category Filter */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors min-w-[200px]"
            >
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-200 flex-1 text-left truncate">
                {getSelectedCategoryNames()}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
            </button>

            {selectedCategories.length > 0 && selectedCategories.length < getAllCategoryIds(categoryTree).length && (
              <button
                onClick={() => setSelectedCategories([])}
                className="absolute -top-2 -right-2 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center hover:bg-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            <AnimatePresence>
              {showCategoryDropdown && (
                <div className="absolute top-full left-0 mt-2 z-50 min-w-[280px]">
                  <CategoryTree
                    categories={categoryTree}
                    selectedCategories={selectedCategories}
                    onChange={setSelectedCategories}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Position Filter */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'Все', count: stats.total },
              { value: 'top', label: 'ТОП 1', count: stats.top1 },
              { value: 'need_action', label: 'Требуют действий', count: stats.needAction },
              { value: 'missing', label: 'Отсутствуют', count: stats.missing },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterPosition(f.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterPosition === f.value
                  ? 'bg-gray-900 dark:bg-emerald-600 text-white'
                  : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600'
                  }`}
              >
                {f.label}
                <span className={`ml-2 ${filterPosition === f.value ? 'opacity-80' : 'text-gray-400'}`}>
                  ({f.count})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Всего товаров</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.top1}</p>
          <p className="text-sm text-emerald-600 dark:text-emerald-400">ТОП 1</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 border border-amber-100 dark:border-amber-800 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.needAction}</p>
          <p className="text-sm text-amber-600 dark:text-amber-400">Требуют действий</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-900/30 rounded-xl p-4 border border-rose-100 dark:border-rose-800 text-center">
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.missing}</p>
          <p className="text-sm text-rose-600 dark:text-rose-400">Отсутствуют</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : filteredProducts.length > 0 ? (
        <ComparisonTable
          products={filteredProducts}
          showNormalized={showNormalized}
          onToggleNormalized={() => setShowNormalized(!showNormalized)}
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-dashed border-gray-200 dark:border-slate-700 shadow-sm">
          <div className="bg-gray-50 dark:bg-slate-900 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Товары не найдены</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-6">
            Попробуйте изменить параметры поиска или фильтры категорий, чтобы увидеть результаты
          </p>
          {(searchTerm || selectedCategories.length > 0 || filterPosition !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategories([]);
                setFilterPosition('all');
              }}
              className="text-emerald-500 font-semibold hover:underline"
            >
              Сбросить все фильтры
            </button>
          )}
        </div>
      )}
    </div>
  );
}
