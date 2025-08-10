import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Button,
  Divider,
  Chip
} from '@mui/material';
import {
  Speed,
  Schedule,
  Storage,
  Wifi,
  WifiOff,
  TrendingUp,
  Warning,
  Close
} from '@mui/icons-material';
import { cacheService } from '../services/cache';

interface PerformanceMetrics {
  cacheHitRate: number;
  cacheSize: number;
  networkLatency: number;
  memoryUsage: number;
  isOnline: boolean;
  lastUpdate: Date;
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    cacheHitRate: 0,
    cacheSize: 0,
    networkLatency: 0,
    memoryUsage: 0,
    isOnline: navigator.onLine,
    lastUpdate: new Date()
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateMetrics = () => {
      const cacheStats = cacheService.getStats();
      
      // 네트워크 지연 시간 측정
      const startTime = performance.now();
      fetch('/api/health')
        .then(() => {
          const endTime = performance.now();
          const latency = endTime - startTime;
          
          setMetrics(prev => ({
            ...prev,
            cacheHitRate: cacheStats.hitRate,
            cacheSize: cacheStats.size,
            networkLatency: latency,
            memoryUsage: (performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0,
            isOnline: navigator.onLine,
            lastUpdate: new Date()
          }));
        })
        .catch(() => {
          setMetrics(prev => ({
            ...prev,
            cacheHitRate: cacheStats.hitRate,
            cacheSize: cacheStats.size,
            networkLatency: -1,
            memoryUsage: (performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0,
            isOnline: false,
            lastUpdate: new Date()
          }));
        });
    };

    // 초기 업데이트
    updateMetrics();

    // 주기적 업데이트 (30초마다)
    const interval = setInterval(updateMetrics, 30000);

    // 온라인/오프라인 상태 변경 감지
    const handleOnline = () => setMetrics(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setMetrics(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // 의존성 배열을 비워서 컴포넌트 마운트 시에만 실행

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'success.main';
    if (value <= thresholds.warning) return 'warning.main';
    return 'error.main';
  };

  const getStatusIcon = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return <TrendingUp sx={{ fontSize: 16 }} />;
    if (value <= thresholds.warning) return <Warning sx={{ fontSize: 16 }} />;
    return <Warning sx={{ fontSize: 16 }} />;
  };

  if (!isVisible) {
    return (
      <IconButton
        onClick={() => setIsVisible(true)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          bgcolor: 'primary.main',
          color: 'white',
          boxShadow: 3,
          '&:hover': {
            bgcolor: 'primary.dark',
          }
        }}
        title="성능 모니터링"
      >
        <Speed sx={{ fontSize: 20 }} />
      </IconButton>
    );
  }

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
      <Card sx={{ width: 320, boxShadow: 6 }}>
        <CardContent sx={{ p: 2 }}>
          {/* 헤더 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
              성능 모니터링
            </Typography>
            <IconButton
              onClick={() => setIsVisible(false)}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 캐시 성능 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  캐시 히트율
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {getStatusIcon(100 - metrics.cacheHitRate, { good: 20, warning: 50 })}
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    color: getStatusColor(100 - metrics.cacheHitRate, { good: 20, warning: 50 })
                  }}
                >
                  {metrics.cacheHitRate.toFixed(1)}%
                </Typography>
              </Box>
            </Box>

            {/* 캐시 크기 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  캐시 크기
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {metrics.cacheSize} 항목
              </Typography>
            </Box>

            {/* 네트워크 지연 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {metrics.isOnline ? (
                  <Wifi sx={{ fontSize: 16, color: 'success.main' }} />
                ) : (
                  <WifiOff sx={{ fontSize: 16, color: 'error.main' }} />
                )}
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  네트워크 지연
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {metrics.networkLatency >= 0 ? (
                  <>
                    {getStatusIcon(metrics.networkLatency, { good: 100, warning: 500 })}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        color: getStatusColor(metrics.networkLatency, { good: 100, warning: 500 })
                      }}
                    >
                      {metrics.networkLatency.toFixed(0)}ms
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'error.main' }}>
                    오프라인
                  </Typography>
                )}
              </Box>
            </Box>

            {/* 메모리 사용량 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Speed sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  메모리 사용량
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {getStatusIcon(metrics.memoryUsage, { good: 50, warning: 100 })}
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    color: getStatusColor(metrics.memoryUsage, { good: 50, warning: 100 })
                  }}
                >
                  {metrics.memoryUsage.toFixed(1)}MB
                </Typography>
              </Box>
            </Box>

            <Divider />

            {/* 마지막 업데이트 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  마지막 업데이트
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {metrics.lastUpdate.toLocaleTimeString()}
              </Typography>
            </Box>

            {/* 캐시 정리 버튼 */}
            <Button
              onClick={() => {
                cacheService.clear();
                setMetrics(prev => ({
                  ...prev,
                  cacheHitRate: 0,
                  cacheSize: 0,
                  lastUpdate: new Date()
                }));
              }}
              variant="outlined"
              size="small"
              sx={{
                mt: 1,
                fontSize: '0.75rem',
                py: 0.5
              }}
            >
              캐시 정리
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PerformanceMonitor; 