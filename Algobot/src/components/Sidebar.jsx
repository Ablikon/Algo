import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCity } from '../contexts/CityContext';
import {
  LayoutDashboard,
  Table2,
  Lightbulb,
  Database,
  TrendingUp,
  Moon,
  Sun,
  ChevronDown,
  Globe,
  MapPin
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t, languages } = useLanguage();
  const { cities, currentCity, selectCity, loading: citiesLoading } = useCity();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showCityMenu, setShowCityMenu] = useState(false);
  const langMenuRef = useRef(null);
  const cityMenuRef = useRef(null);

  // Close lang menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setShowLangMenu(false);
      }
      if (cityMenuRef.current && !cityMenuRef.current.contains(e.target)) {
        setShowCityMenu(false);
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
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 h-screen sticky top-0 flex flex-col shadow-xl z-20">
      {/* Logo */}
      <div className="p-6 shrink-0 border-b border-gray-50 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">PriceAlgo</h1>
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">{t('priceAnalyst')}</p>
          </div>
        </div>
      </div>

      {/* Navigation - Scrollable Area */}
      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <nav className="px-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'opacity-70'}`} />
                <span className="text-sm">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section - Fixed Spacing */}
      <div className="p-4 bg-gray-50/50 dark:bg-slate-900/20 border-t border-gray-100 dark:border-slate-700/50 space-y-2">
        {/* City Selector */}
        {!citiesLoading && cities.length > 0 && (
          <div className="relative" ref={cityMenuRef}>
            <button
              onClick={() => setShowCityMenu(!showCityMenu)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-medium truncate">{currentCity ? currentCity.name : 'Select City'}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showCityMenu ? 'rotate-180' : ''}`} />
            </button>

            {showCityMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50 max-h-60 overflow-y-auto p-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {cities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => {
                      selectCity(city);
                      setShowCityMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${currentCity && currentCity.id === city.id
                      ? 'bg-emerald-500 text-white font-semibold'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                  >
                    <span className="text-sm">{city.name}</span>
                    {currentCity && currentCity.id === city.id && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Theme & Language Row */}
        <div className="flex gap-2">
          <button
            onClick={toggleTheme}
            className="flex-1 flex items-center justify-center p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-500 transition-all shadow-sm"
            title={theme === 'dark' ? t('light') : t('dark')}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="flex-[2] relative" ref={langMenuRef}>
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm"
            >
              <span className="text-sm font-medium">{currentLang?.flag} {currentLang?.code.toUpperCase()}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showLangMenu ? 'rotate-180' : ''}`} />
            </button>

            {showLangMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50 p-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${language === lang.code
                      ? 'bg-emerald-500 text-white font-semibold'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span className="text-sm">{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Partner Banner */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-200/50 dark:shadow-none overflow-hidden relative group">
          <div className="relative z-10">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">{t('glovoPartner')}</h3>
            <p className="text-sm font-semibold leading-tight">{t('optimizeForTop1')}</p>
          </div>
          <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
        </div>
      </div>
    </aside>
  );
}
