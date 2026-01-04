import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import ApiInterceptor from './components/ApiInterceptor';
import { useAuth } from './hooks/useAuth';
import { Box, CircularProgress } from '@mui/material';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Wallets = React.lazy(() => import('./pages/Wallets'));
const Users = React.lazy(() => import('./pages/Users'));
const User = React.lazy(() => import('./pages/User'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Activity = React.lazy(() => import('./pages/Activity'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

// Guard: Only allow access if token exists
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        // Redirect to login, but remember where they were trying to go
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return children;
};

// Guard: Only allow access if token DOES NOT exist (for Login page)
const PublicRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }
    return children;
};

function App() {
    return (
        <ApiInterceptor>
            <Suspense
                fallback={
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            pt: 4,
                        }}
                    >
                        <CircularProgress />
                    </Box>
                }
            >
                <Routes>
                    {/* Public Route (Login) */}
                    <Route
                        path="/login"
                        element={
                            <PublicRoute>
                                <Login />
                            </PublicRoute>
                        }
                    />

                    {/* Protected Routes */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Layout />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="wallets" element={<Wallets />} />
                        <Route path="users" element={<Users />} />
                        <Route path="users/:discordId" element={<User />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="activity" element={<Activity />} />
                    </Route>

                    {/* Catch all */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
        </ApiInterceptor>
    );
}

export default App;
