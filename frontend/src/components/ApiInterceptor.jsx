import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const ApiInterceptor = ({ children }) => {
    const navigate = useNavigate();

    useEffect(() => {
        const interceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    localStorage.removeItem('admin_token');
                    navigate('/login');
                }
                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.response.eject(interceptor);
        };
    }, [navigate]);

    return children;
};

export default ApiInterceptor;
