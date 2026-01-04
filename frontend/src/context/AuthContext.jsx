import { createContext, useState, useMemo } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('admin_token'));

    const login = (newToken) => {
        localStorage.setItem('admin_token', newToken);
        setToken(newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    };

    const logout = () => {
        localStorage.removeItem('admin_token');
        setToken(null);
        delete api.defaults.headers.common['Authorization'];
    };

    const value = useMemo(
        () => ({
            token,
            isAuthenticated: !!token,
            login,
            logout,
        }),
        [token]
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};

export default AuthContext;
