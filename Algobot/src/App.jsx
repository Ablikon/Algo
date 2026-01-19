import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Comparison from './pages/Comparison';
import Recommendations from './pages/Recommendations';
import Analytics from './pages/Analytics';
import DatabaseView from './pages/DatabaseView';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <div className="flex min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/comparison" element={<Comparison />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/database" element={<DatabaseView />} />
              </Routes>
            </main>
          </div>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

