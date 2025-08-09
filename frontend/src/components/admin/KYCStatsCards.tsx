import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, Stack, Typography, LinearProgress, Box } from '@mui/material';
// Grid 호환 이슈 회피: Box CSS 그리드로 대체
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TimerIcon from '@mui/icons-material/Timer';
import { useNavigate } from 'react-router-dom';
import type { KYCStats } from '../../services/adminKYCService';

interface KYCStatsCardsProps {
  stats: KYCStats;
  deltas?: {
    totalApplications?: number; // 전일 대비 증감
    pendingApplications?: number;
    approvalRate?: number; // 퍼센트 포인트 증감
    averageProcessingTime?: string; // "+3m", "-1m" 같은 텍스트
  };
}

function AnimatedCounter({ value, duration = 800, postfix = '' }: { value: number; duration?: number; postfix?: string }) {
  const [display, setDisplay] = useState(0);
  const startTs = useRef<number | null>(null);
  const startVal = useRef(0);

  useEffect(() => {
    startTs.current = null;
    startVal.current = 0;
    const step = (ts: number) => {
      if (!startTs.current) startTs.current = ts;
      const progress = Math.min(1, (ts - startTs.current) / duration);
      const current = Math.round(startVal.current + (value - startVal.current) * progress);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display.toLocaleString()} {postfix}</>;
}

function Delta({ delta, unit = '', positiveGood = true }: { delta?: number; unit?: string; positiveGood?: boolean }) {
  if (delta === undefined || delta === null) return null;
  const isPositive = delta >= 0;
  const color = isPositive === positiveGood ? 'success.main' : 'error.main';
  const sign = isPositive ? '+' : '';
  return (
    <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
      {sign}{delta}{unit}
    </Typography>
  );
}

export default function KYCStatsCards({ stats, deltas }: KYCStatsCardsProps) {
  const navigate = useNavigate();

  const cards = useMemo(() => ([
    {
      key: 'total',
      title: '총 신청',
      value: stats.totalApplications,
      icon: <InsertDriveFileIcon sx={{ color: 'primary.main' }} />,
      onClick: () => navigate('/admin/kyc/history'),
      delta: deltas?.totalApplications,
      renderExtra: null as React.ReactNode,
    },
    {
      key: 'pending',
      title: '대기 중',
      value: stats.pendingApplications,
      icon: <AccessTimeIcon sx={{ color: 'warning.main' }} />,
      onClick: () => navigate('/admin/kyc/pending'),
      delta: deltas?.pendingApplications,
      renderExtra: null as React.ReactNode,
    },
    {
      key: 'approval',
      title: '승인률',
      value: stats.approvalRate,
      icon: <CheckCircleIcon sx={{ color: 'success.main' }} />,
      onClick: () => navigate('/admin/kyc/stats'),
      delta: deltas?.approvalRate,
      renderExtra: (
        <Box sx={{ mt: 1 }}>
          <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, stats.approvalRate))} sx={{ height: 8, borderRadius: 1 }} />
        </Box>
      )
    },
    {
      key: 'avgtime',
      title: '평균 처리시간',
      value: NaN,
      icon: <TimerIcon sx={{ color: 'info.main' }} />,
      onClick: () => navigate('/admin/kyc/stats'),
      deltaText: deltas?.averageProcessingTime,
      renderValue: (
        <Typography variant="h5" fontWeight={700}>
          {stats.averageProcessingTime}
        </Typography>
      ) as React.ReactNode,
    },
  ]), [stats, deltas, navigate]);

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
      gap: 2
    }}>
      {cards.map((c) => (
        <Box key={c.key}>
          <Card
            elevation={2}
            onClick={c.onClick}
            sx={{
              cursor: 'pointer',
              transition: 'box-shadow 0.2s ease, transform 0.1s ease',
              '&:hover': { boxShadow: 6 },
              p: 1,
            }}
          >
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                  {c.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary">{c.title}</Typography>
                  {c.renderValue ? (
                    c.renderValue
                  ) : (
                    <Typography variant="h5" fontWeight={700}>
                      <AnimatedCounter value={Math.round(Number(c.value) || 0)} postfix={c.key === 'approval' ? '%' : ''} />
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    {'delta' in c && c.delta !== undefined ? (
                      <Delta delta={c.delta as number} unit={c.key === 'approval' ? '%' : ''} />
                    ) : c['deltaText'] ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{c['deltaText']}</Typography>
                    ) : null}
                  </Stack>
                  {c.renderExtra}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );
}


