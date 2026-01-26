import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Table2,
  RefreshCw,
  ChevronRight,
  Circle,
  Upload,
  BrainCircuit,
} from "lucide-react";
import {
  aggregatorsAPI,
  categoriesAPI,
  productsAPI,
  recommendationsAPI,
  importAPI,
} from "../services/api";
import BulkImport from "../components/BulkImport";
import { useLanguage } from "../contexts/LanguageContext";
import { useCity } from "../contexts/CityContext";

export default function DatabaseView() {
  const { refreshKey } = useCity();
  const [activeTable, setActiveTable] = useState("aggregators");
  const [showImport, setShowImport] = useState(false);
  const [data, setData] = useState({
    aggregators: [],
    categories: [],
    products: [],
    productsTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    fetchAllData();
  }, [refreshKey]); // Refetch when city changes

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [aggregatorsRes, categoriesRes, productsRes] = await Promise.all([
        aggregatorsAPI.getAll(),
        categoriesAPI.getAll(),
        productsAPI.getComparison({ page: 1, page_size: 100 }),
      ]);
      const productsList = productsRes.data.results || productsRes.data;
      const productsTotal = productsRes.data.count || productsList.length;
      setData({
        aggregators: aggregatorsRes.data,
        categories: categoriesRes.data,
        products: productsList,
        productsTotal,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunMatching = async () => {
    if (
      !confirm("Запустить процесс AI матчинга товаров? Это может занять время.")
    )
      return;

    try {
      await importAPI.runMatching();
      alert(
        "Процесс матчинга запущен в фоновом режиме! Вы можете следить за прогрессом на странице Сравнения цен или Аналитики.",
      );
    } catch (error) {
      console.error("Error starting matching:", error);
      alert(
        "Ошибка при запуске матчинга: " +
          (error.response?.data?.detail || error.message),
      );
    }
  };

  const handleRunExternalImport = async () => {
    if (!confirm("Запустить импорт данных из API?")) return;

    try {
      await importAPI.runExternalImport();
      alert(
        "Импорт запущен в фоновом режиме. Прогресс можно смотреть на странице Аналитики или Сравнения цен.",
      );
    } catch (error) {
      console.error("Error starting external import:", error);
      alert(
        "Ошибка при запуске импорта: " +
          (error.response?.data?.detail || error.message),
      );
    }
  };

  const tables = [
    {
      id: "aggregators",
      name: t("aggregators"),
      count: data.aggregators.length,
      color: "#10b981",
    },
    {
      id: "categories",
      name: t("categories"),
      count: data.categories.length,
      color: "#3b82f6",
    },
    {
      id: "products",
      name: t("products"),
      count: data.productsTotal || data.products.length,
      color: "#8b5cf6",
    },
  ];

  const renderTableContent = () => {
    switch (activeTable) {
      case "aggregators":
        return (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  ID
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {t("name")}
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {t("color")}
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {t("ourCompany")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data.aggregators.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                    {item.id}
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-200">
                    {item.name}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.color}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.is_our_company
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {item.is_our_company ? t("yes") : t("no")}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        );
      case "categories":
        return (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  ID
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {t("name")}
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {t("icon")}
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  Количество товаров
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data.categories.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                    {item.id}
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-200">
                    {item.name}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {item.icon || "—"}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {item.product_count || 0}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        );
      case "products":
        return (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  ID
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {t("name")}
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {t("category")}
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  Glovo
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  Yandex
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  Wolt
                </th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {t("position")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data.products.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                    {item.id}
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-200">
                    {item.name}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {item.category_name}
                  </td>
                  <td className="py-3 px-4">
                    {item.prices?.glovo?.price ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {item.prices.glovo.price}₸
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        —
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.prices?.yandex?.price ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {item.prices.yandex.price}₸
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        —
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.prices?.wolt?.price ? (
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {item.prices.wolt.price}₸
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        —
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.our_position === 1 ? (
                      <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
                        {t("top1")}
                      </span>
                    ) : item.our_position ? (
                      <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
                        #{item.our_position}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-full text-xs font-medium">
                        {t("no")}
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            {t("databaseTitle")}
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1">
            {t("databaseSubtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <button
            onClick={handleRunMatching}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-3 md:px-4 py-2 rounded-xl text-sm md:text-base font-medium transition-colors"
          >
            <BrainCircuit className="w-4 h-4" />
            <span className="hidden sm:inline">AI Матчинг</span>
            <span className="sm:hidden">AI</span>
          </button>
          <button
            onClick={handleRunExternalImport}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-3 md:px-4 py-2 rounded-xl text-sm md:text-base font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Импорт из API</span>
            <span className="sm:hidden">API</span>
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm md:text-base font-medium transition-colors ${
              showImport
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                : "bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{t("import")}</span>
          </button>
          <button
            onClick={fetchAllData}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 md:px-4 py-2 rounded-xl text-sm md:text-base font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("refresh")}</span>
          </button>
        </div>
      </div>

      {/* Import Panel */}
      {showImport && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6"
        >
          <BulkImport onImportComplete={fetchAllData} />
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        {/* Sidebar - Tables List */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 md:p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3 md:mb-4 px-2">
              <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm md:text-base font-semibold text-gray-700 dark:text-gray-200">
                pricing_analytics
              </span>
            </div>
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setActiveTable(table.id)}
                  className={`flex-shrink-0 lg:w-full flex items-center justify-between px-3 py-2 lg:py-2.5 rounded-xl transition-colors text-sm md:text-base ${
                    activeTable === table.id
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Circle
                      className="w-2 h-2"
                      fill={table.color}
                      stroke={table.color}
                    />
                    <span className="font-medium whitespace-nowrap">
                      {table.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                      {table.count}
                    </span>
                    {activeTable === table.id && (
                      <ChevronRight className="w-4 h-4 hidden lg:block" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Schema Info - Hidden on mobile */}
          <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 mt-4">
            <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">
              {t("schema")}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>MongoDB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Table View */}
        <div className="flex-1 min-w-0">
          <motion.div
            key={activeTable}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-slate-700">
              <Table2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {tables.find((t) => t.id === activeTable)?.name}
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({tables.find((t) => t.id === activeTable)?.count}{" "}
                {t("records")})
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">{renderTableContent()}</div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
