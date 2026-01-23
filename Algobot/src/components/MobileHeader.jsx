import { Menu, TrendingUp } from 'lucide-react';
import { useCity } from '../contexts/CityContext';

export default function MobileHeader({ onMenuClick }) {
  const { currentCity } = useCity();

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-white">Pricent</span>
        </div>

        {currentCity && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {currentCity.name}
          </div>
        )}
      </div>
    </header>
  );
}
