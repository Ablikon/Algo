import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  TrendingUp,
  AlertCircle,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import {
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import MatchingProgressBar from "../components/MatchingProgressBar";
import ExternalImportProgressBar from "../components/ExternalImportProgressBar";
import { analyticsAPI, productsAPI } from "../services/api";
import { useCity } from "../contexts/CityContext";
import { useLanguage } from "../contexts/LanguageContext";

import glovoLogo from "../assets/glovo.jpeg";
import magnumLogo from "../assets/Magnum_Cash_&_Carry.png";
import woltLogo from "../assets/Wolt_id52_mlyiE_0.svg";
import airbaFreshLogo from "../assets/Airba Fresh_idYXu-d5px_1.svg";
import yandexLavkaLogo from "../assets/idq0QSew-z_1768990557463.png";
import arbuzLogo from "../assets/id-kqZgjke_1768990623965.jpeg";
import ryadomLogo from "../assets/ryadom.png";

const aggregatorColors = {
  glovo: "#00A082",
  magnum: "#EE1C25",
  wolt: "#00C2E8",
  "airba fresh": "#78B833",
  "yandex lavka": "#FFCC00",
  arbuz: "#FF7F00",
  ryadom: "#6B7280",
  kaspi: "#F14635",
};

const aggregatorLogos = {
  glovo: glovoLogo,
  magnum: magnumLogo,
  wolt: woltLogo,
  "airba fresh": airbaFreshLogo,
  "yandex lavka": yandexLavkaLogo,
  arbuz: arbuzLogo,
  "arbuz.kz": arbuzLogo,
  ryadom: ryadomLogo,
};

const TOP_GAPS = 5;
const EXPANDED_PAGE_SIZE = 20;

export default function Analytics() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllGaps, setShowAllGaps] = useState(false);
  const [gapsPage, setGapsPage] = useState(1);
  const [totalGaps, setTotalGaps] = useState(0);
  const [totalGapsPages, setTotalGapsPages] = useState(0);
  const [gapsLoading, setGapsLoading] = useState(false);
  const { refreshKey, currentCity, loading: cityLoading } = useCity();

  useEffect(() => {
    if (cityLoading) return;
    fetchData();
  }, [refreshKey, currentCity?.slug, cityLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, gapsRes] = await Promise.all([
        analyticsAPI.getDashboard(),
        analyticsAPI.getGaps({ page: 1, page_size: TOP_GAPS }),
      ]);
      setStats(statsRes.data);
      // Handle both array and { results: [...] } formats
      const gapsData = Array.isArray(gapsRes.data) ? gapsRes.data : (gapsRes.data.results || []);
      setGaps(gapsData);
      setTotalGaps(gapsRes.data.total || gapsData.length);
      setGapsPage(1);
      setShowAllGaps(false);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGapsPage = async (page) => {
    setGapsLoading(true);
    try {
      const gapsRes = await analyticsAPI.getGaps({ page, page_size: EXPANDED_PAGE_SIZE });
      const gapsData = Array.isArray(gapsRes.data) ? gapsRes.data : (gapsRes.data.results || []);
      setGaps(gapsData);
      setGapsPage(page);
      setTotalGaps(gapsRes.data.total || gapsData.length);
      setTotalGapsPages(gapsRes.data.total_pages || 1);
    } catch (error) {
      console.error("Error fetching gaps page:", error);
    } finally {
      setGapsLoading(false);
    }
  };

  const handleShowAllGaps = () => {
    if (!showAllGaps) {
      fetchGapsPage(1);
      setShowAllGaps(true);
    } else {
      fetchData();
    }
  };

  // Our products count (Рядом)
  const ryadomStats = Object.values(stats?.aggregator_stats || {}).find(s => s.is_our_company) || stats?.aggregator_stats?.[t("ryadom")];
  const totalOurProducts = ryadomStats?.count || 0;

  // Competitor data - show actual product counts per aggregator (including Рядом)
  const overlapData = stats?.aggregator_stats
    ? Object.entries(stats.aggregator_stats)
      .map(([name, data]) => {
        const normalizedKey = name.toLowerCase().replace(".kz", "").replace(t("ryadom").toLowerCase(), "ryadom").trim();
        return {
          name,
          normalizedKey,
          value: data.count || 0, // Actual product count
          overlap: data.overlap_count || 0,
          color: aggregatorColors[normalizedKey] || "#cbd5e1",
        };
      })
      .filter(item => item.value > 0) // Only show aggregators with products
      .sort((a, b) => b.value - a.value)
    : [];

  const gridColor = "#f1f5f9";
  const textColor = "#94a3b8";

  const formatPrice = (value) => `${value?.toLocaleString()} ₸`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-gray-500 font-medium italic">
            {t("loadingAnalytics")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {t("analyticsTitle")}
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1">
            {t("analyticsSubtitle")}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 px-3 md:px-4 py-2 rounded-xl text-sm md:text-base font-medium transition-all shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">{t("refresh")}</span>
        </button>
      </div>

      <MatchingProgressBar />
      <ExternalImportProgressBar />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 md:gap-8 mb-6 md:mb-10">
        {/* Chart 1: Market Gaps (Assortment Opportunities) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4 md:mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-cyan-100 dark:bg-cyan-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-cyan-600" />
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold text-gray-900 dark:text-white">
                  {showAllGaps ? t("missedOpportunities") : t("top5Gaps")}
                </h3>
                <p className="text-xs md:text-sm text-gray-500 hidden sm:block">
                  {t("competitorsProducts")} {totalGaps > 0 && `(${totalGaps})`}
                </p>
              </div>
            </div>
            {totalGaps > TOP_GAPS && (
              <button
                onClick={handleShowAllGaps}
                disabled={gapsLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {gapsLoading ? t("loading") : showAllGaps ? t("collapse") : t("viewAll")}
              </button>
            )}
          </div>

          <div className="mb-6 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                <span className="font-bold">{t("gapAnalysis")}:</span> {t("gapAnalysisDesc")}
              </p>
            </div>
          </div>

          <div className={`overflow-x-auto ${showAllGaps ? 'min-h-[600px]' : ''}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                    {t("product")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                    {t("category")}
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                    {t("popularity")}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                    {t("minPriceShort")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((item, idx) => (
                  <tr
                    key={item.product_id || idx}
                    className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      {item.product_url ? (
                        <a
                          href={item.product_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline text-sm max-w-[300px] truncate block"
                        >
                          {item.product_name}
                        </a>
                      ) : (
                        <div className="font-semibold text-gray-900 dark:text-white text-sm max-w-[300px] truncate">
                          {item.product_name}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-500 dark:text-gray-400">
                      {item.category || "—"}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400 font-bold text-xs">
                        {item.aggregator_count || item.competitor_count || 2} {t("aggregatorsCount")}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {(item.min_competitor_price || 0).toLocaleString()} ₸
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {gaps.length === 0 && !gapsLoading && (
            <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-3">
              <ShoppingBag className="w-8 h-8 opacity-20" />
              <p>{t("noGapsToDisplay")}</p>
            </div>
          )}

          {gapsLoading && (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
            </div>
          )}

          {/* Pagination */}
          {showAllGaps && totalGapsPages > 1 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t("page")} {gapsPage} {t("of")} {totalGapsPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchGapsPage(gapsPage - 1)}
                  disabled={gapsPage <= 1 || gapsLoading}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← {t("back")}
                </button>
                <button
                  onClick={() => fetchGapsPage(gapsPage + 1)}
                  disabled={gapsPage >= totalGapsPages || gapsLoading}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t("next")} →
                </button>
              </div>
            </div>
          )}

        </motion.div>

        {/* Chart 2: Market Overlap */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4 md:mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold text-gray-900 dark:text-white">
                  {t("competitorsAssortment")}
                </h3>
                <p className="text-xs md:text-sm text-gray-500 hidden sm:block">
                  {t("productsPerAggregator")}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                <span className="font-bold">{t("whatChartMeans")}:</span>{" "}
                {t("chartExplanation")}
              </p>
            </div>
          </div>

          <div className="space-y-6 mt-4">
            {overlapData.map((item, idx) => {
              const maxValue = overlapData[0]?.value || 1;
              const percentage = Math.round((item.value / maxValue) * 100);

              return (
                <div key={item.name} className="flex items-center gap-4 group">
                  {/* Logo Container */}
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center p-2 border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden flex-shrink-0 transition-transform group-hover:scale-105">
                    {aggregatorLogos[item.normalizedKey] ? (
                      <img
                        src={aggregatorLogos[item.normalizedKey]}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white font-bold text-xs rounded-lg"
                        style={{
                          backgroundColor:
                            aggregatorColors[item.normalizedKey] || "#cbd5e1",
                        }}
                      >
                        {item.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info and Progress Bar */}
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-900 dark:text-white">
                          {item.value.toLocaleString('ru-RU')} {t("productsUpper")}
                        </span>
                      </div>
                    </div>

                    {/* Professional Slim Bar */}
                    <div className="h-2 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{
                          duration: 1,
                          delay: 0.2,
                          ease: "easeOut",
                        }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {overlapData.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>{t("noOverlapData")}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
