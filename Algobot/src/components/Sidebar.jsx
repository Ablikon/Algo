import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Table2,
  Lightbulb,
  Database,
  TrendingUp,
  Moon,
  Sun,
  ChevronDown,
  Globe
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function Sidebar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t, languages } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef(null);

  // Close lang menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { path: '/', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/comparison', icon: Table2, labelKey: 'comparison' },
    { path: '/recommendations', icon: Lightbulb, labelKey: 'recommendations' },
    { path: '/analytics', icon: TrendingUp, labelKey: 'analytics' },
    { path: '/database', icon: Database, labelKey: 'database' },
  ];

  const currentLang = languages.find(l => l.code === language);

  return (
    <aside className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 h-screen sticky top-0 flex flex-col">
      {/* Logo */}
      <div className="p-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">PriceAlgo</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('priceAnalyst')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-4 py-2 shrink-0">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 ${isActive
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings Section */}
      <div className="px-4 py-3 space-y-2 shrink-0">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600"
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {theme === 'dark' ? t('dark') : t('light')}
            </span>
          </div>
          <div className="w-9 h-5 bg-gray-200 dark:bg-slate-600 rounded-full p-0.5 relative">
            <div
              className={`w-4 h-4 bg-white dark:bg-emerald-400 rounded-full shadow-sm absolute top-0.5 transition-transform duration-200 ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                }`}
            />
          </div>
        </button>

        {/* Language Selector */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="text-sm font-medium">{currentLang?.flag} {currentLang?.name}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showLangMenu ? 'rotate-180' : ''}`} />
          </button>

          {showLangMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 rounded-xl shadow-lg border border-gray-200 dark:border-slate-600 overflow-hidden z-50">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLangMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-600 ${language === lang.code
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'text-gray-700 dark:text-gray-200'
                    }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="text-sm font-medium">{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-0" />

      {/* Bottom Banner */}
      <div className="p-4 shrink-0">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 text-white">
          <h3 className="font-semibold mb-1">{t('glovoPartner')}</h3>
          <p className="text-sm text-emerald-100">{t('optimizeForTop1')}</p>
        </div>
      </div>
    </aside>
  );
}
