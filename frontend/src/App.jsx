import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Wallets from './pages/Wallets';
import Settings from './pages/Settings';
import Activity from './pages/Activity';
import NotFound from './pages/NotFound';
import ApiInterceptor from './components/ApiInterceptor';

// Guard: Only allow access if token exists
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('admin_token');
  const location = useLocation();

  if (!token) {
    // Redirect to login, but remember where they were trying to go
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

// Guard: Only allow access if token DOES NOT exist (for Login page)
const PublicRoute = ({ children }) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
        return <Navigate to="/dashboard" replace />;
    }
    return children;
};

function App() {
  return (
    <ApiInterceptor>
      <Routes>
        {/* Public Route (Login) */}
        <Route path="/login" element={
            <PublicRoute>
                <Login />
            </PublicRoute>
        } />
        
        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="wallets" element={<Wallets />} />
          <Route path="settings" element={<Settings />} />
          <Route path="activity" element={<Activity />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ApiInterceptor>
  );
}

export default App;