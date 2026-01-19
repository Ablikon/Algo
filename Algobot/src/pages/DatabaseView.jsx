import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, Table2, RefreshCw, ChevronRight, Circle } from 'lucide-react';
import { aggregatorsAPI, categoriesAPI, productsAPI, recommendationsAPI } from '../services/api';

export default function DatabaseView() {
  const [activeTable, setActiveTable] = useState('aggregators');
  const [data, setData] = useState({
    aggregators: [],
    categories: [],
    products: [],
    recommendations: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [aggregatorsRes, categoriesRes, productsRes, recommendationsRes] = await Promise.all([
        aggregatorsAPI.getAll(),
        categoriesAPI.getAll(),
        productsAPI.getComparison(),
        recommendationsAPI.getAll(),
      ]);
      setData({
        aggregators: aggregatorsRes.data,
        categories: categoriesRes.data,
        products: productsRes.data,
        recommendations: recommendationsRes.data,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tables = [
    { id: 'aggregators', name: 'Агрегаторы', count: data.aggregators.length, color: '#10b981' },
    { id: 'categories', name: 'Категории', count: data.categories.length, color: '#3b82f6' },
    { id: 'products', name: 'Товары', count: data.products.length, color: '#8b5cf6' },
    { id: 'recommendations', name: 'Рекомендации', count: data.recommendations.length, color: '#f59e0b' },
  ];

  const renderTableContent = () => {
    switch (activeTable) {
      case 'aggregators':
        return (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Название</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Цвет</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Наша компания</th>
              </tr>
            </thead>
            <tbody>
              {data.aggregators.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 text-sm text-gray-500">{item.id}</td>
                  <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-600">{item.color}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.is_our_company
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.is_our_company ? 'Да' : 'Нет'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        );
      case 'categories':
        return (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Название</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Иконка</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 text-sm text-gray-500">{item.id}</td>
                  <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{item.icon || '—'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        );
      case 'products':
        return (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Название</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Категория</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Glovo</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Yandex</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Wolt</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Позиция</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 text-sm text-gray-500">{item.id}</td>
                  <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{item.category_name}</td>
                  <td className="py-3 px-4">
                    {item.prices?.glovo?.price ? (
                      <span className="text-emerald-600 font-medium">{item.prices.glovo.price}₸</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.prices?.yandex?.price ? (
                      <span className="text-amber-600 font-medium">{item.prices.yandex.price}₸</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.prices?.wolt?.price ? (
                      <span className="text-blue-600 font-medium">{item.prices.wolt.price}₸</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.our_position === 1 ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                        ТОП 1
                      </span>
                    ) : item.our_position ? (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                        №{item.our_position}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-medium">
                        Нет
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        );
      case 'recommendations':
        return (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Товар</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Действие</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Текущая</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Рекомендуемая</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Приоритет</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.recommendations.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 text-sm text-gray-500">{item.id}</td>
                  <td className="py-3 px-4 font-medium text-gray-900">{item.product_name}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.action_type === 'LOWER_PRICE'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.action_type === 'LOWER_PRICE' ? 'Снизить цену' : 'Добавить товар'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {item.current_price ? `${item.current_price}₸` : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-emerald-600">
                    {item.recommended_price}₸
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.priority === 'HIGH'
                        ? 'bg-rose-100 text-rose-700'
                        : item.priority === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.priority === 'HIGH'
                        ? 'Высокий'
                        : item.priority === 'MEDIUM'
                        ? 'Средний'
                        : 'Низкий'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.status === 'APPLIED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.status === 'REJECTED'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.status === 'APPLIED'
                        ? 'Применено'
                        : item.status === 'REJECTED'
                        ? 'Отклонено'
                        : 'В ожидании'}
                    </span>
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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">База данных</h1>
          <p className="text-gray-500 mt-1">Изучите структуру и данные</p>
        </div>
        <button
          onClick={fetchAllData}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar - Tables List */}
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4 px-2">
              <Database className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-700">pricing_analytics</span>
            </div>
            <div className="space-y-1">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setActiveTable(table.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                    activeTable === table.id
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Circle
                      className="w-2 h-2"
                      fill={table.color}
                      stroke={table.color}
                    />
                    <span className="font-medium">{table.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                      {table.count}
                    </span>
                    {activeTable === table.id && (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Schema Info */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mt-4">
            <h4 className="font-semibold text-gray-700 mb-3">Схема</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>PostgreSQL</span>
                <span className="text-emerald-600">v17</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Таблиц</span>
                <span>{tables.length}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Всего записей</span>
                <span>{tables.reduce((acc, t) => acc + t.count, 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Table View */}
        <div className="flex-1">
          <motion.div
            key={activeTable}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <Table2 className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">
                {tables.find((t) => t.id === activeTable)?.name}
              </h3>
              <span className="text-sm text-gray-500">
                ({tables.find((t) => t.id === activeTable)?.count} записей)
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                {renderTableContent()}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
