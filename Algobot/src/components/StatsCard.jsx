import { motion } from 'framer-motion';

export default function StatsCard({ title, value, subtitle, icon: Icon, color, trend }) {
  const colorClasses = {
    emerald: 'from-emerald-500 to-teal-500',
    blue: 'from-blue-500 to-indigo-500',
    amber: 'from-amber-500 to-orange-500',
    rose: 'from-rose-500 to-pink-500',
    purple: 'from-purple-500 to-violet-500',
  };

  const bgColorClasses = {
    emerald: 'bg-emerald-50',
    blue: 'bg-blue-50',
    amber: 'bg-amber-50',
    rose: 'bg-rose-50',
    purple: 'bg-purple-50',
  };

  const iconColorClasses = {
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    purple: 'text-purple-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`inline-flex items-center gap-1 mt-2 text-sm ${
              trend > 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              <span>{trend > 0 ? '+' : ''}{trend}%</span>
              <span className="text-gray-400">по сравнению с прошлой неделей</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl ${bgColorClasses[color]} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColorClasses[color]}`} />
        </div>
      </div>
    </motion.div>
  );
}
