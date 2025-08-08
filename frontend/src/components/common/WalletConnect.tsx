import React from 'react';
import {
  Box,
  Button,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  CircularProgress
} from '@mui/material';
import {
  AccountBalanceWallet,
  CheckCircle,
  Error,
  Warning,
  Close,
  Security,
  TrendingUp,
  AccountBalance,
  Send
} from '@mui/icons-material';
import { useWeb3 } from '../../contexts/Web3Context';

interface WalletConnectProps {
  className?: string;
  showModal?: boolean;
  onClose?: () => void;
}

const WalletConnect: React.FC<WalletConnectProps> = ({
  className = '',
  showModal = false,
  onClose
}) => {
  const { web3State, connectWallet, disconnectWallet, isConnecting, error, clearError } = useWeb3();

  const handleConnect = async () => {
    await connectWallet();
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num >= 1) {
      return `${num.toFixed(4)} ETH`;
    } else {
      return `${(num * 1000).toFixed(2)} Gwei`;
    }
  };

  const getNetworkName = (chainId: number | null) => {
    switch (chainId) {
      case 1:
        return 'Ethereum Mainnet';
      case 3:
        return 'Ropsten Testnet';
      case 4:
        return 'Rinkeby Testnet';
      case 5:
        return 'Goerli Testnet';
      case 42:
        return 'Kovan Testnet';
      case 1337:
        return 'Localhost';
      default:
        return 'Unknown Network';
    }
  };

  const isSupportedNetwork = (chainId: number | null) => {
    const supportedChains = [1, 3, 4, 5, 42, 1337]; // 지원하는 네트워크
    return chainId ? supportedChains.includes(chainId) : false;
  };

  if (web3State.isConnected) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }} className={className}>
        {/* Network Status */}
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            bgcolor: 'grey.50',
            borderRadius: 2
          }}
        >
          <Box sx={{ position: 'relative' }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: isSupportedNetwork(web3State.chainId) ? 'success.main' : 'error.main'
              }}
            />
            {isSupportedNetwork(web3State.chainId) && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
                  '@keyframes ping': {
                    '75%, 100%': {
                      transform: 'scale(2)',
                      opacity: 0,
                    },
                  },
                }}
              />
            )}
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
            {getNetworkName(web3State.chainId)}
          </Typography>
        </Paper>

        {/* Account Info */}
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
            borderRadius: 2,
            border: '1px solid #90caf9'
          }}
        >
          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: 'primary.dark',
              fontFamily: 'monospace'
            }}
          >
            {web3State.account ? formatAddress(web3State.account) : 'Unknown'}
          </Typography>
        </Paper>

        {/* Balance */}
        {web3State.balance && (
          <Paper
            elevation={0}
            sx={{
              px: 1.5,
              py: 1,
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
              {formatBalance(web3State.balance)}
            </Typography>
          </Paper>
        )}

        {/* Disconnect Button */}
        <Button
          onClick={handleDisconnect}
          startIcon={<Close />}
          sx={{
            px: 1.5,
            py: 1,
            color: 'text.secondary',
            '&:hover': {
              color: 'error.main',
              bgcolor: 'error.50'
            },
            borderRadius: 2,
            textTransform: 'none',
            minWidth: 'auto'
          }}
        >
          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
            연결 해제
          </Typography>
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        variant="contained"
        startIcon={isConnecting ? <CircularProgress size={16} color="inherit" /> : <AccountBalanceWallet />}
        sx={{
          px: 3,
          py: 1.5,
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 500,
          boxShadow: 2,
          '&:hover': {
            boxShadow: 4,
            transform: 'translateY(-1px)',
          },
          '&:disabled': {
            opacity: 0.5,
            transform: 'none',
          },
          transition: 'all 0.3s ease'
        }}
      >
        {isConnecting ? '연결 중...' : '지갑 연결'}
      </Button>

      {/* Error Dialog */}
      <Dialog
        open={!!error}
        onClose={clearError}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Error color="error" />
          지갑 연결 오류
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>연결 실패</AlertTitle>
            {error}
          </Alert>
          
          <Typography variant="h6" sx={{ mb: 1 }}>
            해결 방법:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <AccountBalanceWallet fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="MetaMask가 설치되어 있는지 확인하세요" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="MetaMask에서 계정을 선택했는지 확인하세요" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Security fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="올바른 네트워크에 연결되어 있는지 확인하세요" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearError} variant="contained">
            확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connection Dialog */}
      <Dialog
        open={showModal && !web3State.isConnected}
        onClose={onClose || (() => {})}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center' }}>
          <AccountBalanceWallet sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            MetaMask 지갑 연결
          </Typography>
          <Typography variant="body1" color="text.secondary">
            HomeSure 플랫폼을 사용하려면 MetaMask 지갑을 연결해야 합니다.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Available Features */}
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                연결 후 가능한 기능:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <TrendingUp fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="부동산 토큰 구매 및 판매" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AccountBalance fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="포트폴리오 관리" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Send fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="거래 내역 확인" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AccountBalanceWallet fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="토큰 전송" />
                </ListItem>
              </List>
            </Paper>

            {/* Warnings */}
            <Alert severity="warning">
              <AlertTitle>주의사항</AlertTitle>
              <List dense sx={{ py: 0 }}>
                <ListItem sx={{ py: 0 }}>
                  <ListItemText primary="• 투자에 따른 손실 위험을 충분히 인지하세요" />
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <ListItemText primary="• 개인키를 안전하게 보관하세요" />
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <ListItemText primary="• 의심스러운 사이트에서는 지갑을 연결하지 마세요" />
                </ListItem>
              </List>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={handleConnect}
            variant="contained"
            disabled={isConnecting}
            startIcon={isConnecting ? <CircularProgress size={20} /> : <AccountBalanceWallet />}
            sx={{ flex: 1, py: 1.5 }}
          >
            {isConnecting ? '연결 중...' : 'MetaMask 연결'}
          </Button>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{ flex: 1, py: 1.5 }}
          >
            취소
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WalletConnect; 