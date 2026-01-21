import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const dropdownRef = useRef(null);

  const fetchData = useCallback(async (isMounted = { current: true }) => {
    setLoading(true);
    try {
      const params = {
        page: 1,
        page_size: 1000,
        'category_ids[]': selectedCategories
      };

      const [productsRes, categoriesRes, treeRes] = await Promise.all([
        productsAPI.getComparison(params),
        categoriesAPI.getAll(),
        categoriesAPI.getTree(),
      ]);

      if (isMounted.current) {
        const productsData = productsRes.data.results || productsRes.data;
        const metaData = productsRes.data.meta || {};

        setProducts(productsData);
        setCategories(categoriesRes.data);
        setCategoryTree(treeRes.data);

        if (metaData.aggregators) {
          window.allAggregators = metaData.aggregators;
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [selectedCategories, refreshKey]);

  useEffect(() => {
    const isMounted = { current: true };
    fetchData(isMounted);
    return () => { isMounted.current = false; };
  }, [fetchData, refreshTrigger]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Export handler - opens CSV export with current filters
  const handleExport = () => {
    const params = new URLSearchParams();
    const citySlug = localStorage.getItem('selectedCity');
    if (citySlug) {
      params.append('city', citySlug);
    }
    if (selectedCategories.length > 0) {
      selectedCategories.forEach(id => params.append('category_ids[]', id));
    }
    window.open(`http://localhost:8000/api/export/products/?${params.toString()}`, '_blank');
  };

  // Stage 1: Filter by search and categories
  const baseFilteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category_id);

      if (!matchesSearch || !matchesCategory) return false;

      return true;
    });
  }, [products, searchTerm, selectedCategories]);

  // Calculate stats based on base filtered products (ignores current position filter)
  const stats = useMemo(() => {
    return {
      total: baseFilteredProducts.length,
      top1: baseFilteredProducts.filter((p) => p.our_position === 1).length,
      needAction: baseFilteredProducts.filter((p) => p.our_position !== null && p.our_position > 1).length,
      missing: baseFilteredProducts.filter((p) => p.our_position === null).length,
    };
  }, [baseFilteredProducts]);

  // Stage 2: Filter by position for display
  const filteredProducts = useMemo(() => {
    return baseFilteredProducts.filter((product) => {
      if (filterPosition === 'all') return true;
      if (filterPosition === 'top') return product.our_position === 1;
      if (filterPosition === 'need_action') return product.our_position !== null && product.our_position > 1;
      if (filterPosition === 'missing') return product.our_position === null;
      return true;
    });
  }, [baseFilteredProducts, filterPosition]);

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Мониторинг цен</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Детальный анализ цен конкурентов</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Экспорт
          </button>
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
      </div>

      {/* Filters & Tabs */}
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

            <AnimatePresence mode="wait">
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

          {/* Position Filter Tabs */}
          <div className="flex gap-2 p-1 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-slate-700">
            {[
              { value: 'all', label: 'Все товары', count: stats.total },
              { value: 'top', label: 'ТОП-1', count: stats.top1 },
              { value: 'need_action', label: 'Выше рынка', count: stats.needAction },
              { value: 'missing', label: 'Пробелы', count: stats.missing },
            ].map((f) => {
              const showSkeleton = loading && products.length === 0;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilterPosition(f.value)}
                  disabled={showSkeleton}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap min-w-[120px] ${filterPosition === f.value
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm'
                    }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {f.label}
                    {showSkeleton ? (
                      <div className="w-6 h-4 skeleton opacity-50" />
                    ) : (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${filterPosition === f.value ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>
                        {f.count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Всего в выборке', value: stats.total, color: 'emerald', key: 'total' },
          { label: 'ТОП-1 Лидеры', value: stats.top1, color: 'blue', key: 'top1' },
          { label: 'Цена выше рынка', value: stats.needAction, color: 'amber', key: 'action' },
          { label: 'Пробелы ассортимента', value: stats.missing, color: 'rose', key: 'missing' },
        ].map((card) => {
          const isLoading = loading && products.length === 0;
          return (
            <div
              key={card.key}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group"
            >
              {isLoading ? (
                <div className="space-y-3">
                  <div className="w-20 h-8 skeleton" />
                  <div className="w-32 h-4 skeleton opacity-60" />
                </div>
              ) : (
                <>
                  <p className={`text-2xl font-black text-gray-900 dark:text-white`}>
                    {card.value.toLocaleString()}
                  </p>
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">
                    {card.label}
                  </p>
                  {/* Decorative background accent */}
                  <div className={`absolute top-0 right-0 w-16 h-16 opacity-5 bg-${card.color}-500 rounded-bl-[40px] group-hover:scale-110 transition-transform`} />
                </>
              )}
            </div>
          );
        })}
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
