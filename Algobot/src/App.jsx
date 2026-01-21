import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { CityProvider } from './contexts/CityContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Comparison from './pages/Comparison';
import Recommendations from './pages/Recommendations';
import Analytics from './pages/Analytics';
import DatabaseView from './pages/DatabaseView';

function AppContent() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 relative overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full h-full p-0"
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/comparison" element={<Comparison />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/database" element={<DatabaseView />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <CityProvider>
          <Router>
            <AppContent />
          </Router>
        </CityProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

