import React, { useMemo, useState } from 'react';
import { Chip, Tooltip, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, LinearProgress, Box } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

export type RiskTrend = 'up' | 'down' | 'flat';

export interface RiskBreakdownItem {
  label: string;
  value: number; // 0-100 scale per component
  weight?: number; // optional weight percentage
}

export interface RiskScoreChipProps {
  score: number; // 0-100
  breakdown?: RiskBreakdownItem[];
  trend?: RiskTrend;
  title?: string;
}

function getCategory(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score <= 30) return 'LOW';
  if (score <= 70) return 'MEDIUM';
  return 'HIGH';
}

export default function RiskScoreChip({ score, breakdown, trend = 'flat', title }: RiskScoreChipProps) {
  const [open, setOpen] = useState(false);

  const category = useMemo(() => getCategory(score), [score]);
  const { bg, fg, icon } = useMemo(() => {
    switch (category) {
      case 'LOW':
        return { bg: '#4caf50', fg: '#ffffff', icon: <CheckCircleOutlineIcon fontSize="small" /> };
      case 'MEDIUM':
        return { bg: '#ff9800', fg: '#ffffff', icon: <WarningAmberIcon fontSize="small" /> };
      case 'HIGH':
      default:
        return { bg: '#f44336', fg: '#ffffff', icon: <ErrorOutlineIcon fontSize="small" /> };
    }
  }, [category]);

  const trendIcon = useMemo(() => {
    if (trend === 'up') return <ArrowUpwardIcon fontSize="small" sx={{ color: '#f44336' }} />; // higher risk
    if (trend === 'down') return <ArrowDownwardIcon fontSize="small" sx={{ color: '#4caf50' }} />; // lower risk
    return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
  }, [trend]);

  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
        {title || '위험도 구성'}
      </Typography>
      {breakdown && breakdown.length > 0 ? (
        <Stack spacing={0.5} sx={{ minWidth: 220 }}>
          {breakdown.map((item) => (
            <Box key={item.label}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption">{item.label}</Typography>
                <Typography variant="caption">{Math.round(item.value)}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, item.value))} sx={{ height: 6, borderRadius: 1 }} />
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">상세 구성 정보가 없습니다.</Typography>
      )}
    </Box>
  );

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Tooltip title={tooltipContent} arrow placement="top">
          <Chip
            onClick={() => setOpen(true)}
            label={`${score}`}
            icon={icon}
            sx={{
              bgcolor: bg,
              color: fg,
              fontWeight: 600,
              '& .MuiChip-icon': { color: fg },
              cursor: 'pointer',
            }}
            size="small"
          />
        </Tooltip>
        {trendIcon}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>위험도 분석 상세</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">현재 점수:</Typography>
              <Chip label={`${score} (${category})`} sx={{ bgcolor: bg, color: '#fff' }} size="small" />
            </Stack>
            {breakdown && breakdown.length > 0 ? (
              <Stack spacing={1}>
                {breakdown.map((item) => (
                  <Box key={item.label}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">{item.label}</Typography>
                      <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'right' }}>{Math.round(item.value)}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, item.value))} sx={{ height: 8, borderRadius: 1 }} />
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">상세 구성 데이터가 제공되지 않았습니다.</Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} variant="outlined">닫기</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}


