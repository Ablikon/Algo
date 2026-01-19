import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Comparison from './pages/Comparison';
import Recommendations from './pages/Recommendations';
import Analytics from './pages/Analytics';
import DatabaseView from './pages/DatabaseView';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50">
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
  );
}

export default App;
