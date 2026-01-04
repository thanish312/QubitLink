import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        open: 'http://localhost:3000', // Open the correct URL when dev server starts
        proxy: {
            // Proxy API requests to the Express server
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
            '/webhook': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
