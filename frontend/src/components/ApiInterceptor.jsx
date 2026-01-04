import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

const ApiInterceptor = ({ children }) => {
    const { logout } = useAuth();

    useEffect(() => {
        const interceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.response.eject(interceptor);
        };
    }, [logout]);

    return children;
};

export default ApiInterceptor;
