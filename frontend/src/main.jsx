import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import {
    ThemeProvider,
    createTheme,
    CssBaseline,
    GlobalStyles,
} from '@mui/material';
import App from './App.jsx';

import { AuthProvider } from './context/AuthContext';

// A Modern, Deep Dark Theme
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#6366f1' }, // Indigo (Modern Blurple)
        secondary: { main: '#10b981' }, // Emerald Green (Success)
        background: {
            default: '#09090b', // Almost black
            paper: '#18181b', // Zinc-900
        },
        text: {
            primary: '#f4f4f5',
            secondary: '#a1a1aa',
        },
        divider: '#27272a',
    },
    typography: {
        fontFamily: '"Inter", "Segoe UI", "Roboto", sans-serif',
        h3: { fontWeight: 700, letterSpacing: '-0.02em' },
        h4: { fontWeight: 600, letterSpacing: '-0.01em' },
        h6: { fontWeight: 600 },
        subtitle1: { color: '#a1a1aa' },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    textTransform: 'none',
                    fontWeight: 600,
                    padding: '8px 20px',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    border: '1px solid #27272a', // Subtle border for definition
                    backgroundImage: 'none',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow:
                        '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                },
            },
        },
    },
});

// Custom Scrollbar Styles
const globalStyles = (
    <GlobalStyles
        styles={{
            '*::-webkit-scrollbar': { width: '8px' },
            '*::-webkit-scrollbar-track': { background: '#09090b' },
            '*::-webkit-scrollbar-thumb': {
                background: '#3f3f46',
                borderRadius: '4px',
            },
            '*::-webkit-scrollbar-thumb:hover': { background: '#52525b' },
        }}
    />
);

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
        },
    },
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                {globalStyles}
                <SnackbarProvider
                    maxSnack={3}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <BrowserRouter>
                        <AuthProvider>
                            <App />
                        </AuthProvider>
                    </BrowserRouter>
                </SnackbarProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </React.StrictMode>
);
