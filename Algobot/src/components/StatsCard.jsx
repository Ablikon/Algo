import { motion } from 'framer-motion';

export default function StatsCard({ title, value, unit, subtitle, icon: Icon, color, trend }) {
  const bgColorClasses = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30',
    blue: 'bg-blue-50 dark:bg-blue-900/30',
    amber: 'bg-amber-50 dark:bg-amber-900/30',
    rose: 'bg-rose-50 dark:bg-rose-900/30',
    purple: 'bg-purple-50 dark:bg-purple-900/30',
  };

  const iconColorClasses = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
    purple: 'text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 font-medium truncate">{title}</p>
          <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1 md:mt-2">
            {typeof value === 'number' ? value.toLocaleString() : value}
            {unit && <span className="text-sm md:text-base font-medium text-gray-500 dark:text-gray-400 ml-1">{unit}</span>}
          </p>
          {subtitle && (
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className={`inline-flex items-center gap-1 mt-1 md:mt-2 text-xs md:text-sm ${trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
              <span>{trend > 0 ? '+' : ''}{trend}%</span>
            </div>
          )}
        </div>
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${bgColorClasses[color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 md:w-6 md:h-6 ${iconColorClasses[color]}`} />
        </div>
      </div>
    </div>
  );
}

