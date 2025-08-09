import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  IconButton, 
  Menu, 
  MenuItem, 
  Avatar, 
  Chip,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  AccountCircle, 
  ExpandMore,
  Home,
  TrendingUp,
  Business,
  Security,
  Person,
  Add
} from '@mui/icons-material';
import WalletConnect from '../common/WalletConnect';
import { useWeb3 } from '../../contexts/Web3Context';
import { useUser } from '../../contexts/UserContext';

interface Tab {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  route?: string;
}

interface HeaderProps {
  tabs?: Tab[];
  activeTab?: string; // deprecated
  onTabChange?: (tabId: string) => void; // deprecated
}

const Header: React.FC<HeaderProps> = ({ tabs, activeTab, onTabChange }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { web3State, disconnectWallet } = useWeb3();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  const location = useLocation();

  const handleTabChange = (tabId: string, route?: string) => {
    if (route) {
      navigate(route);
    } else if (onTabChange) {
      onTabChange(tabId);
    }
    setIsMobileMenuOpen(false);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Home': return Home;
      case 'TrendingUp': return TrendingUp;
      case 'Building2': return Business;
      case 'Shield': return Security;
      case 'User': return Person;
      case 'Plus': return Add;
      default: return Home;
    }
  };

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleTabChange('portfolio', '/portfolio')}>
          <Avatar 
            sx={{ 
              bgcolor: 'primary.main',
              width: 40,
              height: 40,
              mr: 2,
              boxShadow: 2
            }}
          >
            🏠
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', background: 'linear-gradient(45deg, #1976d2, #42a5f5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              HomeSure
            </Typography>
            <Typography variant="caption" color="text.secondary">
              부동산 토큰화 플랫폼
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', display: { xs: 'block', sm: 'none' } }}>
            HS
          </Typography>
        </Box>

        {/* Desktop Navigation */}
        {tabs && !isMobile && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {tabs.map((tab) => {
              const IconComponent = getIconComponent(tab.icon.name);
              const isActive = tab.route ? location.pathname.startsWith(tab.route) : activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id, tab.route)}
                  variant={isActive ? 'contained' : 'text'}
                  startIcon={<IconComponent />}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 500,
                    ...(isActive && {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      }
                    })
                  }}
                >
                  {tab.name}
                </Button>
              );
            })}
          </Box>
        )}

        {/* Desktop Actions */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 2 }}>
          {web3State.isConnected ? (
            <Box sx={{ position: 'relative' }}>
              <Button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                variant="outlined"
                startIcon={<AccountCircle />}
                endIcon={<ExpandMore />}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip 
                    label="연결됨" 
                    size="small" 
                    color="success" 
                    sx={{ height: 20 }}
                  />
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {formatAddress(web3State.account!)}
                  </Typography>
                </Box>
              </Button>

              <Menu
                anchorEl={document.querySelector('[data-testid="user-menu-button"]')}
                open={isUserMenuOpen}
                onClose={() => setIsUserMenuOpen(false)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 250,
                    borderRadius: 2,
                    boxShadow: 3,
                  }
                }}
              >
                <MenuItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    지갑 주소
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {web3State.account}
                  </Typography>
                </MenuItem>
                <Divider />
                <MenuItem 
                  onClick={() => {
                    disconnectWallet();
                    setIsUserMenuOpen(false);
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon>
                    <AccountCircle fontSize="small" />
                  </ListItemIcon>
                  연결 해제
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <WalletConnect />
          )}
        </Box>

        {/* Mobile menu button */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          <IconButton
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            sx={{ color: 'text.primary' }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      </Toolbar>

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="top"
        open={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        PaperProps={{
          sx: {
            top: 64,
            height: 'calc(100vh - 64px)',
            borderRadius: '0 0 16px 16px',
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          {tabs && (
            <List>
              {tabs.map((tab) => {
                const IconComponent = getIconComponent(tab.icon.name);
                return (
                  <ListItem
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id, tab.route)}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      cursor: 'pointer',
                      backgroundColor: (tab.route ? location.pathname.startsWith(tab.route) : activeTab === tab.id) ? 'primary.main' : 'transparent',
                      color: (tab.route ? location.pathname.startsWith(tab.route) : activeTab === tab.id) ? 'white' : 'inherit',
                      '&:hover': {
                        backgroundColor: (tab.route ? location.pathname.startsWith(tab.route) : activeTab === tab.id) ? 'primary.dark' : 'action.hover',
                      }
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit' }}>
                      <IconComponent />
                    </ListItemIcon>
                    <ListItemText primary={tab.name} />
                  </ListItem>
                );
              })}
            </List>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Mobile Wallet Info */}
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, mb: 2 }}>
            {web3State.isConnected ? (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  지갑 연결됨
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {formatAddress(web3State.account!)}
                </Typography>
                <Chip 
                  label="연결됨" 
                  size="small" 
                  color="success" 
                  sx={{ mt: 1 }}
                />
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  지갑을 연결하세요
                </Typography>
                <WalletConnect />
              </Box>
            )}
          </Box>

          {web3State.isConnected && (
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={() => {
                disconnectWallet();
                setIsMobileMenuOpen(false);
              }}
              startIcon={<AccountCircle />}
            >
              연결 해제
            </Button>
          )}
        </Box>
      </Drawer>
    </AppBar>
  );
};

export default Header; 