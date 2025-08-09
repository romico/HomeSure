import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Container } from '@mui/material';
import { Home, TrendingUp, Business, Security, Person, Settings, Add } from '@mui/icons-material';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PerformanceMonitor from './components/PerformanceMonitor';
import { UserProvider } from './contexts/UserContext';
import { Web3Provider } from './contexts/Web3Context';
import { PropertyProvider } from './contexts/PropertyContext';
import { RealTimeProvider } from './contexts/RealTimeContext';
import { TransactionProvider } from './contexts/TransactionContext';
import ToastContainer from './components/common/ToastContainer';
import './App.css';
import ProtectedRoute from './components/ProtectedRoute';

const DbTestPage = lazy(async () => ({ default: (await import('./pages/DbTestPage')).default }));
const LoginPage = lazy(async () => ({ default: (await import('./pages/Login')).default }));
const Portfolio = lazy(async () => ({ default: (await import('./components/Portfolio')).default }));
const PropertyList = lazy(async () => ({ default: (await import('./components/PropertyList')).default }));
const TradingSystem = lazy(async () => ({ default: (await import('./components/TradingSystem')).default }));
const KYCSystem = lazy(async () => ({ default: (await import('./components/KYCSystem')).default }));
const KYCDashboard = lazy(async () => ({ default: (await import('./components/admin/KYCDashboard')).default }));
const KYCApplicationDetailPage = lazy(async () => ({ default: (await import('./pages/KYCApplicationDetail')).default }));
const PropertyRegistration = lazy(async () => ({ default: (await import('./components/PropertyRegistration')).default }));

// Material UI 테마 생성
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

const tabs = [
  { id: 'portfolio', name: '포트폴리오', icon: Home, route: '/portfolio' },
  { id: 'properties', name: '부동산', icon: Business, route: '/properties' },
  { id: 'trading', name: '거래', icon: TrendingUp, route: '/trading' },
  { id: 'kyc', name: 'KYC', icon: Person, route: '/kyc' },
  { id: 'register', name: '부동산 등록', icon: Add, route: '/register' },
  { id: 'admin', name: '관리자', icon: Security, route: '/admin' },
  // { id: 'dbtest', name: 'DB 테스트', icon: Settings, route: '/dbtest' },
];

function App() {

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastContainer>
        <UserProvider>
          <Web3Provider>
            <PropertyProvider>
              <RealTimeProvider>
                <TransactionProvider>
                  <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                    <Header tabs={tabs} />
                     <Container maxWidth="xl" sx={{ py: 4 }}>
                      <Suspense fallback={<div>Loading...</div>}>
                        <Routes>
                          <Route path="/" element={<Navigate to="/portfolio" replace />} />
                           <Route path="/login" element={<LoginPage />} />
                          <Route path="/portfolio" element={<Portfolio />} />
                          <Route path="/properties" element={<PropertyList />} />
                           <Route path="/trading" element={<TradingSystem />} />
                           <Route path="/kyc" element={<KYCSystem />} />
                           <Route path="/register" element={
                             <ProtectedRoute isAuthenticated={!!localStorage.getItem('accessToken')}>
                               <PropertyRegistration />
                             </ProtectedRoute>
                           } />
                          <Route path="/admin/kyc/application/:id" element={<KYCApplicationDetailPage />} />
                          <Route path="/admin/*" element={<KYCDashboard />} />
                          <Route path="/dbtest" element={<DbTestPage />} />
                          <Route path="*" element={<Navigate to="/portfolio" replace />} />
                        </Routes>
                      </Suspense>
                    </Container>
                    <Footer />
                    <PerformanceMonitor />
                  </Box>
                </TransactionProvider>
              </RealTimeProvider>
            </PropertyProvider>
          </Web3Provider>
        </UserProvider>
      </ToastContainer>
    </ThemeProvider>
  );
}

export default App;
