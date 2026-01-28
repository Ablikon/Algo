import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileQuestion,
  Search,
  Cloud,
  ChevronDown,
} from "lucide-react";
import { importAPI } from "../services/api";

const verdictStyles = {
  correct: {
    label: "Корректно",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  needs_review: {
    label: "Проверить",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: AlertTriangle,
  },
  likely_wrong: {
    label: "Ошибка",
    color: "bg-rose-100 text-rose-700 border-rose-200",
    icon: XCircle,
  },
  unmapped: {
    label: "Не замаплено",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: FileQuestion,
  },
  not_found: {
    label: "Не найдено",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: FileQuestion,
  },
};

export default function MappingReview() {
  const [matchedAggregator, setMatchedAggregator] = useState("");
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");
  const [filterVerdict, setFilterVerdict] = useState("all");

  // External API files
  const [apiFiles, setApiFiles] = useState([]);
  const [selectedApiFile, setSelectedApiFile] = useState("");
  const [loadingApiFiles, setLoadingApiFiles] = useState(false);

  // Load API files on mount
  useEffect(() => {
    loadApiFiles();
  }, []);

  const loadApiFiles = async () => {
    setLoadingApiFiles(true);
    try {
      const response = await importAPI.getMappedApiFiles();
      setApiFiles(response.data.files || []);
    } catch (error) {
      console.error("Failed to load API files:", error);
    } finally {
      setLoadingApiFiles(false);
    }
  };

  const handleReviewFromApi = async () => {
    if (!selectedApiFile) {
      alert("Выбери mapped-файл из списка");
      return;
    }

    setLoading(true);
    try {
      const params = {
        file_id: selectedApiFile,
        source_aggregator: "Рядом",
      };
      if (matchedAggregator) params.matched_aggregator = matchedAggregator;
      if (limit) params.limit = Number(limit);

      const response = await importAPI.reviewMappedFromApi(params);
      setSummary(response.data.summary);
      setResults(response.data.results || []);
    } catch (error) {
      alert(
        "Ошибка при проверке: " +
          (error.response?.data?.detail || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  // Source file is fixed in DB (bq-results), no local file selection needed.

  const filteredResults = results.filter((item) => {
    const verdictOk = filterVerdict === "all" || item.verdict === filterVerdict;

    const query = search.trim().toLowerCase();
    if (!query) return verdictOk;

    const sourceName = item.source?.title?.toLowerCase() || "";
    const matchedName = item.matched?.name?.toLowerCase() || "";
    const reason = item.reason?.toLowerCase() || "";

    return (
      verdictOk &&
      (sourceName.includes(query) ||
        matchedName.includes(query) ||
        reason.includes(query))
    );
  });

  const SummaryCard = ({ label, value, className }) => (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            Проверка маппинга
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1">
            Перепроверка замапленных товаров. Источник: bq-results (уже в базе).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadApiFiles}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm font-semibold"
            disabled={loadingApiFiles}
          >
            {loadingApiFiles ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            Обновить список
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-slate-700 mb-6">
        {/* API Files Section */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            Mapped-файлы из API
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-2">
                Выбери mapped-файл
              </label>
              <div className="relative">
                <select
                  value={selectedApiFile}
                  onChange={(e) => setSelectedApiFile(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-sm appearance-none cursor-pointer"
                >
                  <option value="">-- Выбери файл --</option>
                  {apiFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.filename || file.id}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleReviewFromApi}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
                disabled={loading || !selectedApiFile}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Проверить из API
              </button>
            </div>
          </div>
          {apiFiles.length === 0 && !loadingApiFiles && (
            <p className="text-xs text-gray-400 mt-2">
              Нет доступных mapped-файлов. Нажми "Обновить список".
            </p>
          )}
        </div>

        {/* Source in DB */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Источник (фиксированный)
            </label>
            <div className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-sm text-gray-700 dark:text-gray-200">
              bq-results-20260120-103930-1768905602731.csv (уже в базе)
            </div>
          </div>
          {/* <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Агрегатор matched (необязательно)
            </label>
            <input
              type="text"
              value={matchedAggregator}
              onChange={(e) => setMatchedAggregator(e.target.value)}
              placeholder="Wolt / Yandex Lavka / Magnum..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-sm"
            />
          </div> */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Лимит записей
            </label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="например 500"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <SummaryCard
            label="Всего"
            value={summary.total}
            className="bg-white"
          />
          <SummaryCard
            label="Корректно"
            value={summary.correct}
            className="bg-emerald-50 border-emerald-100"
          />
          <SummaryCard
            label="Проверить"
            value={summary.needs_review}
            className="bg-amber-50 border-amber-100"
          />
          <SummaryCard
            label="Ошибка"
            value={summary.likely_wrong}
            className="bg-rose-50 border-rose-100"
          />
          <SummaryCard
            label="Не замаплено"
            value={summary.unmapped}
            className="bg-gray-50 border-gray-100"
          />
          <SummaryCard
            label="Не найдено"
            value={summary.not_found}
            className="bg-slate-50 border-slate-100"
          />
        </div>
      )}

      {/* Filters */}
      {results.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию или причине..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
            />
          </div>
          <select
            value={filterVerdict}
            onChange={(e) => setFilterVerdict(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
          >
            <option value="all">Все статусы</option>
            <option value="correct">Корректно</option>
            <option value="needs_review">Проверить</option>
            <option value="likely_wrong">Ошибка</option>
            <option value="unmapped">Не замаплено</option>
            <option value="not_found">Не найдено</option>
          </select>
        </div>
      )}

      {/* Results table */}
      {filteredResults.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    Вердикт
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    Источник (Рядом)
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    Матч
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    Причина
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredResults.map((row, idx) => {
                  const style =
                    verdictStyles[row.verdict] || verdictStyles.needs_review;
                  const Icon = style.icon;
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${style.color}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {style.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 text-sm">
                          {row.source?.title || "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {row.source?.brand || "—"} ·{" "}
                          {row.source?.category || "—"}
                        </div>
                        {row.source?.url && (
                          <a
                            href={row.source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Ссылка
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 text-sm">
                          {row.matched?.name || "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {row.matched?.brand || "—"} ·{" "}
                          {row.matched?.category || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {row.reason || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          Нет результатов для отображения
        </div>
      )}
    </div>
  );
}
