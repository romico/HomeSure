import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Stack, Tooltip, Typography, LinearProgress } from '@mui/material';

export interface ApprovalRateDonutProps {
  percent: number; // 0-100 (소수점 허용)
  approved: number;
  rejected: number;
  trendData?: number[]; // 최근 승인률 시계열 (예: 주별/월별)
  trendLabel?: string; // 예: '주별', '월별'
  goal?: number; // 목표 승인률 (0-100)
  durationMs?: number; // 0% -> percent 애니메이션 시간
  size?: number; // 원형 크기(px)
  thickness?: number; // 진행 바 두께
}

function useAnimatedNumber(target: number, duration: number = 1000) {
  const [value, setValue] = useState(0);
  const startTs = useRef<number | null>(null);
  const startVal = useRef(0);

  useEffect(() => {
    startTs.current = null;
    startVal.current = 0;
    let raf = 0;
    const step = (ts: number) => {
      if (startTs.current == null) startTs.current = ts;
      const t = Math.min(1, (ts - startTs.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = startVal.current + (target - startVal.current) * eased;
      setValue(current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function getColor(p: number): string {
  if (p >= 90) return '#4caf50'; // green
  if (p >= 70) return '#ff9800'; // orange
  return '#f44336'; // red
}

function Sparkline({ data, color = '#1976d2', width = 120, height = 28 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
  const points = data.map((v, i) => {
    const x = pad + (w * i) / (data.length - 1 || 1);
    const y = pad + h - h * norm(v);
    return `${x},${y}`;
  });
  const path = `M ${points.join(' L ')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="승인률 추이 미니 차트">
      <polyline fill="none" stroke={color} strokeWidth={2} points={points.join(' ')} />
    </svg>
  );
}

export default function ApprovalRateDonut({
  percent,
  approved,
  rejected,
  trendData,
  trendLabel = '추이',
  goal,
  durationMs = 1200,
  size = 140,
  thickness = 6,
}: ApprovalRateDonutProps) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const animVal = useAnimatedNumber(clamped, durationMs);
  const color = useMemo(() => getColor(clamped), [clamped]);
  const tooltip = (
    <Box>
      <Typography variant="caption" sx={{ display: 'block' }}>승인률: {clamped.toFixed(1)}%</Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>승인: {approved.toLocaleString()}건</Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>거절: {rejected.toLocaleString()}건</Typography>
      {typeof goal === 'number' && (
        <Typography variant="caption" sx={{ display: 'block' }}>목표: {goal.toFixed(1)}%</Typography>
      )}
    </Box>
  );

  const goalProgress = typeof goal === 'number' ? Math.max(0, Math.min(100, (clamped / (goal || 100)) * 100)) : null;

  return (
    <Stack spacing={1.5} alignItems="center">
      <Tooltip title={tooltip} arrow>
        <Box
          aria-label="승인률 원형 진행 바"
          sx={{ position: 'relative', width: size, height: size, display: 'inline-block' }}
        >
          {/* 배경 트랙 */}
          <CircularProgress
            variant="determinate"
            value={100}
            size={size}
            thickness={thickness}
            sx={{
              color: 'action.hover',
              position: 'absolute',
              inset: 0,
              transform: 'rotate(-90deg)',
              '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
            }}
          />

          {/* 진행 링 */}
          <CircularProgress
            variant="determinate"
            value={animVal}
            size={size}
            thickness={thickness}
            sx={{
              color,
              position: 'absolute',
              inset: 0,
              transform: 'rotate(-90deg)',
              '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
            }}
          />

          {/* 중앙 라벨 */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
              {animVal.toFixed(1)}%
            </Typography>
          </Box>
        </Box>
      </Tooltip>

      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="caption" color="text.secondary">승인 {approved.toLocaleString()}</Typography>
        <Typography variant="caption" color="text.secondary">거절 {rejected.toLocaleString()}</Typography>
      </Stack>

      {trendData && trendData.length > 0 && (
        <Stack alignItems="center" spacing={0.5}>
          <Typography variant="caption" color="text.secondary">{trendLabel} 변화 추이</Typography>
          <Sparkline data={trendData} color={color} />
        </Stack>
      )}

      {typeof goal === 'number' && (
        <Stack spacing={0.5} sx={{ width: '100%', maxWidth: 260 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">목표 달성도</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>{Math.min(100, Math.max(0, goalProgress || 0)).toFixed(0)}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={goalProgress || 0} sx={{ height: 8, borderRadius: 1 }} />
        </Stack>
      )}
    </Stack>
  );
}


