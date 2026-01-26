import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  RefreshCw,
  Download,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ComparisonTable from "../components/ComparisonTable";
import MatchingProgressBar from "../components/MatchingProgressBar";
import ExternalImportProgressBar from "../components/ExternalImportProgressBar";
import CategoryTree from "../components/CategoryTree";
import { productsAPI, categoriesAPI } from "../services/api";
import { useCity } from "../contexts/CityContext";
import { useDebounce } from "../hooks/useDebounce"; // Assuming this hook exists or I will implement simple debounce

export default function Comparison() {
  const { refreshKey } = useCity();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtering & Pagination State
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showNormalized, setShowNormalized] = useState(false);

  // Pagination State
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const dropdownRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchData = useCallback(
    async (isMounted = { current: true }) => {
      setLoading(true);
      try {
        const params = {
          page: pagination.page,
          page_size: pagination.pageSize,
          "category_ids[]": selectedCategories,
          search: debouncedSearch,
          city: localStorage.getItem("selectedCity"),
        };

        const [productsRes, categoriesRes, treeRes] = await Promise.all([
          productsAPI.getComparison(params),
          categoriesAPI.getAll(),
          categoriesAPI.getTree(),
        ]);

        if (isMounted.current) {
          const results = productsRes.data.results || [];
          const count = productsRes.data.count || 0;

          setProducts(results);
          setPagination((prev) => ({
            ...prev,
            total: count,
            totalPages: Math.ceil(count / prev.pageSize),
          }));

          setCategories(categoriesRes.data);
          setCategoryTree(treeRes.data);

          // Update aggregators metadata
          if (productsRes.data.meta?.aggregators) {
            window.allAggregators = productsRes.data.meta.aggregators;
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [
      pagination.page,
      pagination.pageSize,
      selectedCategories,
      debouncedSearch,
      refreshKey,
      refreshTrigger,
    ],
  );

  useEffect(() => {
    const isMounted = { current: true };
    fetchData(isMounted);
    return () => {
      isMounted.current = false;
    };
  }, [fetchData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getAllCategoryIds = (cats) => {
    const ids = [];
    const collect = (categories) => {
      categories.forEach((cat) => {
        ids.push(cat.id);
        if (cat.children) collect(cat.children);
      });
    };
    collect(cats);
    return ids;
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    const citySlug = localStorage.getItem("selectedCity");
    if (citySlug) params.append("city", citySlug);
    if (selectedCategories.length > 0) {
      selectedCategories.forEach((id) => params.append("category_ids[]", id));
    }
    if (debouncedSearch) {
      params.append("search", debouncedSearch);
    }
    window.open("/api/export/products/?" + params.toString(), "_blank");
  };

  const getSelectedCategoryNames = () => {
    if (selectedCategories.length === 0) return "Все категории";
    if (selectedCategories.length === getAllCategoryIds(categoryTree).length)
      return "Все категории";
    const names = categories
      .filter((c) => selectedCategories.includes(c.id))
      .map((c) => c.name);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2} `;
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="p-4 md:p-8 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            Мониторинг цен
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
            {pagination.total} товаров (Стр. {pagination.page}/
            {Math.max(1, pagination.totalPages)})
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 px-3 md:px-4 py-2 rounded-xl text-sm md:text-base font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Экспорт</span>
          </button>
          <button
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 md:px-4 py-2 rounded-xl text-sm md:text-base font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Обновить</span>
          </button>
        </div>
      </div>

      <MatchingProgressBar />
      <ExternalImportProgressBar />

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 md:p-4 shadow-sm border border-gray-100 dark:border-slate-700 mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск товаров..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm md:text-base"
            />
          </div>

          {/* Category Filter */}
          <div className="relative sm:w-auto" ref={dropdownRef}>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full sm:w-auto flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-100 sm:min-w-[200px]"
            >
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-200 flex-1 text-left truncate text-sm md:text-base">
                {getSelectedCategoryNames()}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${showCategoryDropdown ? "rotate-180" : ""}`}
              />
            </button>

            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="absolute -top-2 -right-2 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center hover:bg-gray-600 shadow-sm"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            <AnimatePresence mode="wait">
              {showCategoryDropdown && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 z-50 w-full sm:min-w-[280px]">
                  <CategoryTree
                    categories={categoryTree}
                    selectedCategories={selectedCategories}
                    onChange={(cats) => {
                      setSelectedCategories(cats);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-gray-100">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : products.length > 0 ? (
        <div className="space-y-6">
          <ComparisonTable
            products={products}
            showNormalized={showNormalized}
            onToggleNormalized={() => setShowNormalized(!showNormalized)}
          />

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 pt-4">
              <div className="text-xs sm:text-sm text-gray-500 order-2 sm:order-1">
                {(pagination.page - 1) * pagination.pageSize + 1}-
                {Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.total,
                )}{" "}
                из {pagination.total}
              </div>
              <div className="flex gap-1 sm:gap-2 order-1 sm:order-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 sm:px-3 sm:py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Назад</span>
                </button>
                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      let pageNum = i + 1;
                      if (pagination.totalPages > 5 && pagination.page > 3) {
                        pageNum = pagination.page - 2 + i;
                      }
                      if (pageNum > pagination.totalPages) return null;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-sm font-medium transition-colors ${
                            pagination.page === pageNum
                              ? "bg-emerald-500 text-white"
                              : "hover:bg-gray-50 text-gray-600"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    },
                  )}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 sm:px-3 sm:py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm font-medium"
                >
                  <span className="hidden sm:inline">Вперед</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-dashed border-gray-200 shadow-sm">
          <div className="bg-gray-50 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Товары не найдены
          </h3>
          <p className="text-gray-500 mb-6">
            Нет товаров, соответствующих вашим фильтрам
          </p>
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedCategories([]);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="text-emerald-500 font-semibold hover:underline"
          >
            Сбросить фильтры
          </button>
        </div>
      )}
    </div>
  );
}
