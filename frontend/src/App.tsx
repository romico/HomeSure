import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Container } from '@mui/material';
import { 
  Home, 
  TrendingUp, 
  Business, 
  Security, 
  Person, 
  Settings,
  Add
} from '@mui/icons-material';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Portfolio from './components/Portfolio';
import PropertyList from './components/PropertyList';
import TradingSystem from './components/TradingSystem';
import KYCSystem from './components/KYCSystem';
import KYCDashboard from './components/admin/KYCDashboard';
import PropertyRegistration from './components/PropertyRegistration';
import PerformanceMonitor from './components/PerformanceMonitor';
import { UserProvider } from './contexts/UserContext';
import { Web3Provider } from './contexts/Web3Context';
import { PropertyProvider } from './contexts/PropertyContext';
import { RealTimeProvider } from './contexts/RealTimeContext';
import { TransactionProvider } from './contexts/TransactionContext';
import ToastContainer from './components/common/ToastContainer';
import './App.css';

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
  { id: 'portfolio', name: '포트폴리오', icon: Home },
  { id: 'properties', name: '부동산', icon: Business },
  { id: 'trading', name: '거래', icon: TrendingUp },
  { id: 'kyc', name: 'KYC', icon: Person },
  { id: 'register', name: '부동산 등록', icon: Add },
  { id: 'admin', name: '관리자', icon: Security },
];

function App() {
  const [activeTab, setActiveTab] = useState('portfolio');

  const renderContent = () => {
    switch (activeTab) {
      case 'portfolio':
        return <Portfolio />;
      case 'properties':
        return <PropertyList />;
      case 'trading':
        return <TradingSystem />;
      case 'kyc':
        return <KYCSystem />;
      case 'register':
        return <PropertyRegistration />;
      case 'admin':
        return <KYCDashboard />;
      default:
        return <Portfolio />;
    }
  };

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
                    <Header 
                      tabs={tabs}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                    <Container maxWidth="xl" sx={{ py: 4 }}>
                      {renderContent()}
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
