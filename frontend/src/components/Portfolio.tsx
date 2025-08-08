import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  AlertTitle
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  PieChart,
  Refresh,
  Wifi,
  WifiOff,
  Storage
} from '@mui/icons-material';
import PortfolioChart from './charts/PortfolioChart';
import AssetDistributionChart from './charts/AssetDistributionChart';
import { useWeb3 } from '../contexts/Web3Context';
import { useTransaction } from '../contexts/TransactionContext';
import { useRealTime } from '../contexts/RealTimeContext';
import { useToast } from './common/ToastContainer';
import cacheService from '../services/cache';

interface PortfolioData {
  date: string;
  value: number;
  change: number;
  changePercent: number;
}

interface AssetData {
  id: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
}

const Portfolio: React.FC = () => {
  const { web3State } = useWeb3();
  const { state: transactionState } = useTransaction();
  const { state: realTimeState, subscribeToPortfolio, subscribeToTransactions, refreshData, clearCache } = useRealTime();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [portfolioData, setPortfolioData] = useState<PortfolioData[]>([]);
  const [assetData, setAssetData] = useState<AssetData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // 색상 팔레트
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#06B6D4', // cyan
    '#F97316', // orange
    '#84CC16', // lime
  ];

  // 샘플 데이터 생성 (실제로는 API에서 가져옴)
  const generateSampleData = () => {
    const now = new Date();
    const portfolio: PortfolioData[] = [];
    const assets: AssetData[] = [];

    // 포트폴리오 데이터 생성 (최근 30일)
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const baseValue = 100 + Math.random() * 50;
      const change = (Math.random() - 0.5) * 10;
      const value = baseValue + change;
      
      portfolio.push({
        date: date.toISOString(),
        value: parseFloat(value.toFixed(4)),
        change: parseFloat(change.toFixed(4)),
        changePercent: parseFloat(((change / baseValue) * 100).toFixed(2)),
      });
    }

    // 자산 분포 데이터 생성
    const assetNames = ['부동산 A', '부동산 B', '부동산 C', '부동산 D', '부동산 E'];
    const totalValue = portfolio[portfolio.length - 1].value;
    
    assetNames.forEach((name, index) => {
      const value = totalValue * (0.1 + Math.random() * 0.3); // 10-40% 분배
      assets.push({
        id: `asset-${index}`,
        name,
        value: parseFloat(value.toFixed(4)),
        percentage: parseFloat(((value / totalValue) * 100).toFixed(1)),
        color: colors[index % colors.length],
      });
    });

    return { portfolio, assets };
  };

  // 데이터 로드
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 실제 구현에서는 API 호출
      await new Promise(resolve => setTimeout(resolve, 1000)); // 시뮬레이션
      
      const { portfolio, assets } = generateSampleData();
      setPortfolioData(portfolio);
      setAssetData(assets);
      setLastUpdated(new Date());
      
      showSuccess('포트폴리오 데이터가 업데이트되었습니다.');
    } catch (error) {
      showError('데이터 로드 중 오류가 발생했습니다.');
      console.error('Portfolio data load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 실시간 구독 설정
  useEffect(() => {
    if (web3State.isConnected && web3State.account) {
      subscribeToPortfolio();
      subscribeToTransactions();
    }
  }, [web3State.isConnected, web3State.account, subscribeToPortfolio, subscribeToTransactions]);

  // 온라인/오프라인 상태 감지
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    if (web3State.isConnected) {
      loadData();
    }
  }, [web3State.isConnected]);

  // 캐시 정리
  const handleClearCache = async () => {
    try {
      await clearCache();
      showSuccess('캐시가 정리되었습니다.');
    } catch (error) {
      showError('캐시 정리 중 오류가 발생했습니다.');
    }
  };

  // 통계 계산
  const calculateStats = () => {
    if (portfolioData.length === 0) return null;

    const latest = portfolioData[portfolioData.length - 1];
    const previous = portfolioData[portfolioData.length - 2] || latest;
    
    const totalValue = latest.value;
    const dailyChange = latest.change;
    const dailyChangePercent = latest.changePercent;
    const assetCount = assetData.length;

    return {
      totalValue,
      dailyChange,
      dailyChangePercent,
      assetCount
    };
  };

  const stats = calculateStats();

  // 지갑이 연결되지 않은 경우
  if (!web3State.isConnected) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2
        }}
      >
        <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
          <Box
            sx={{
              width: 96,
              height: 96,
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
              boxShadow: 3
            }}
          >
            <AttachMoney sx={{ fontSize: 48, color: 'white' }} />
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
            지갑을 연결해주세요
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
            포트폴리오를 확인하려면 지갑을 연결해야 합니다.
          </Typography>
          
          <Paper
            sx={{
              p: 3,
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              borderRadius: 2
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              연결 후 가능한 기능:
            </Typography>
            <List dense>
              <ListItem sx={{ py: 0.5 }}>
                <Box sx={{ width: 8, height: 8, bgcolor: 'primary.main', borderRadius: '50%', mr: 1.5 }} />
                <ListItemText primary="실시간 포트폴리오 추적" />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <Box sx={{ width: 8, height: 8, bgcolor: 'primary.main', borderRadius: '50%', mr: 1.5 }} />
                <ListItemText primary="자산 분포 분석" />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <Box sx={{ width: 8, height: 8, bgcolor: 'primary.main', borderRadius: '50%', mr: 1.5 }} />
                <ListItemText primary="거래 내역 확인" />
              </ListItem>
            </List>
          </Paper>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #ffffff 50%, #f5f7fa 100%)'
      }}
    >
      <Box sx={{ maxWidth: 'xl', mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: 4 }}>
        {/* 헤더 */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}
          >
            포트폴리오 대시보드
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            {web3State.account ? `${web3State.account.slice(0, 6)}...${web3State.account.slice(-4)}` : 'Unknown'} 님의 투자 현황
          </Typography>
        </Box>

        {/* 상태 표시 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <Paper
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              borderRadius: 2
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              마지막 업데이트: {lastUpdated.toLocaleString()}
            </Typography>
          </Paper>

          {isOffline ? (
            <Chip
              icon={<WifiOff />}
              label="오프라인"
              color="error"
              size="small"
            />
          ) : (
            <Chip
              icon={<Wifi />}
              label="실시간"
              color="success"
              size="small"
            />
          )}

          <Chip
            icon={<Storage />}
            label="캐시"
            color="warning"
            size="small"
          />
        </Box>

        {/* 액션 버튼 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button
            onClick={loadData}
            disabled={isLoading}
            variant="contained"
            startIcon={isLoading ? <CircularProgress size={20} /> : <Refresh />}
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
              }
            }}
          >
            {isLoading ? '새로고침 중...' : '새로고침'}
          </Button>
          
          <Button
            onClick={handleClearCache}
            variant="outlined"
            sx={{ color: 'text.secondary' }}
          >
            캐시 정리
          </Button>
        </Box>

        {stats && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
            {/* 총 포트폴리오 */}
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 12px)' } }}>
              <Card
                sx={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        총 포트폴리오
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                        ${stats.totalValue.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 2
                      }}
                    >
                      <AttachMoney sx={{ fontSize: 24, color: 'white' }} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* 일일 변동 */}
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 12px)' } }}>
              <Card
                sx={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        일일 변동
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 'bold',
                          mt: 0.5,
                          color: stats.dailyChange >= 0 ? 'success.main' : 'error.main'
                        }}
                      >
                        {stats.dailyChange >= 0 ? '+' : ''}${stats.dailyChange.toFixed(2)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: stats.dailyChange >= 0 ? 'success.main' : 'error.main',
                        boxShadow: 2
                      }}
                    >
                      {stats.dailyChange >= 0 ? (
                        <TrendingUp sx={{ fontSize: 24, color: 'white' }} />
                      ) : (
                        <TrendingDown sx={{ fontSize: 24, color: 'white' }} />
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* 변동률 */}
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 12px)' } }}>
              <Card
                sx={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        변동률
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 'bold',
                          mt: 0.5,
                          color: stats.dailyChangePercent >= 0 ? 'success.main' : 'error.main'
                        }}
                      >
                        {stats.dailyChangePercent >= 0 ? '+' : ''}{stats.dailyChangePercent.toFixed(2)}%
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: stats.dailyChangePercent >= 0 ? 'success.main' : 'error.main',
                        boxShadow: 2
                      }}
                    >
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                        {stats.dailyChangePercent >= 0 ? '+' : ''}{stats.dailyChangePercent.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* 보유 자산 */}
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 12px)' } }}>
              <Card
                sx={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        보유 자산
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                        {stats.assetCount}개
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 2
                      }}
                    >
                      <PieChart sx={{ fontSize: 24, color: 'white' }} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}

        {/* 차트 섹션 */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
          <Box sx={{ flex: { xs: '1 1 100%', lg: '2 1 0' } }}>
            <Card
              sx={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0, 0, 0, 0.1)'
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  포트폴리오 성과
                </Typography>
                <PortfolioChart data={portfolioData} />
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 0' } }}>
            <Card
              sx={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0, 0, 0, 0.1)'
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  자산 분포
                </Typography>
                <AssetDistributionChart data={assetData} />
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* 거래 내역 */}
        <Card
          sx={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 0, 0, 0.1)'
          }}
        >
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              최근 거래 내역
            </Typography>
            
            {transactionState.transactions.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: 'grey.100',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2
                  }}
                >
                  <Storage sx={{ fontSize: 32, color: 'grey.400' }} />
                </Box>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  거래 내역이 없습니다.
                </Typography>
              </Box>
            ) : (
              <List>
                {transactionState.transactions.slice(0, 5).map((transaction, index) => (
                  <React.Fragment key={transaction.id}>
                    <ListItem
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        bgcolor: 'grey.50',
                        borderRadius: 2,
                        mb: 1,
                        '&:hover': {
                          bgcolor: 'grey.100',
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {transaction.description}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {new Date(transaction.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {transaction.amount}
                        </Typography>
                        <Chip
                          label={transaction.type}
                          size="small"
                          color={transaction.type === 'buy' ? 'success' : 'error'}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </Box>
                    </ListItem>
                    {index < transactionState.transactions.slice(0, 5).length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Portfolio; 