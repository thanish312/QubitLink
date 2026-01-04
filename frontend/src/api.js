import axios from 'axios';

// Point to your Express Server
const API_URL = import.meta.env.VITE_API_URL || '/api/admin';

const api = axios.create({
    baseURL: API_URL,
});

// Add Token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
