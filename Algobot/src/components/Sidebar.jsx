import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Table2,
  Lightbulb,
  Database,
  TrendingUp,
  Settings
} from 'lucide-react';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { path: '/comparison', icon: Table2, label: 'Сравнение цен' },
  { path: '/recommendations', icon: Lightbulb, label: 'Рекомендации' },
  { path: '/analytics', icon: TrendingUp, label: 'Аналитика' },
  { path: '/database', icon: Database, label: 'База данных' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">PriceAlgo</h1>
            <p className="text-xs text-gray-500">Ценовой аналитик</p>
          </div>
        </div>
      </div>

      <nav className="px-4 py-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : ''}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-gray-200">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 text-white">
          <h3 className="font-semibold mb-1">Партнёр Glovo</h3>
          <p className="text-sm text-emerald-100">Оптимизация для позиции №1</p>
        </div>
      </div>
    </aside>
  );
}
