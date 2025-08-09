import React, { useMemo } from 'react';
import {
  Drawer,
  Box,
  Stack,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper
} from '@mui/material';
// Grid 호환 이슈 회피: Box CSS 그리드로 대체
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import FlagIcon from '@mui/icons-material/Flag';
import HistoryIcon from '@mui/icons-material/History';
import SvgIcon from '@mui/material/SvgIcon';
import AddressDisplay from '../common/AddressDisplay';

export interface RiskCategoryScore {
  name: string;
  score: number; // 0-100
}

export interface RiskFlag {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  label: string;
  description?: string;
}

export interface RiskHistoryItem {
  date: string; // ISO
  status: string;
  note?: string;
}

export interface ExternalMatchItem {
  source: string; // e.g., "OFAC", "PEP DB"
  matched: boolean;
  note?: string;
}

export interface RiskAnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  score: number; // 0-100
  categories?: RiskCategoryScore[];
  rationale?: string[];
  flags?: RiskFlag[];
  previousHistory?: RiskHistoryItem[];
  relatedAddresses?: string[];
  tradingPatterns?: string[];
  externalMatches?: ExternalMatchItem[];
}

function Gauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = -90 + (clamped / 100) * 180; // -90 to +90

  const arc = (start: number, end: number, color: string) => {
    const r = 90;
    const cx = 100;
    const cy = 100;
    const startRad = (Math.PI / 180) * start;
    const endRad = (Math.PI / 180) * end;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = end - start > 180 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
    return <path d={d} stroke={color} strokeWidth={10} fill="none" />;
  };

  const needleX = 100 + 80 * Math.cos((Math.PI / 180) * angle);
  const needleY = 100 + 80 * Math.sin((Math.PI / 180) * angle);
  const color = clamped >= 90 ? '#4caf50' : clamped >= 70 ? '#ff9800' : '#f44336';

  return (
    <SvgIcon viewBox="0 0 200 120" sx={{ width: '100%', height: 'auto' }}>
      {/* background arcs */}
      {arc(-90, -30, '#f44336')}
      {arc(-30, 30, '#ff9800')}
      {arc(30, 90, '#4caf50')}
      {/* needle */}
      <circle cx={100} cy={100} r={5} fill="#666" />
      <line x1={100} y1={100} x2={needleX} y2={needleY} stroke={color} strokeWidth={4} strokeLinecap="round" />
    </SvgIcon>
  );
}

export default function RiskAnalysisPanel({
  open,
  onClose,
  score,
  categories = [],
  rationale = [],
  flags = [],
  previousHistory = [],
  relatedAddresses = [],
  tradingPatterns = [],
  externalMatches = [],
}: RiskAnalysisPanelProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 480, md: 520 } } }}>
      <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" fontWeight={700}>위험도 분석</Typography>
          <IconButton onClick={onClose} aria-label="close"><CloseIcon /></IconButton>
        </Stack>

        {/* 총 점수 게이지 */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">총 점수</Typography>
          <Gauge value={score} />
          <Typography variant="h5" fontWeight={700} textAlign="center">{score.toFixed(1)} / 100</Typography>
        </Paper>

        {/* 카테고리별 점수 */}
        {categories.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>카테고리별 점수</Typography>
            <Stack spacing={1.2}>
              {categories.map((c) => (
                <Box key={c.name}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{c.name}</Typography>
                    <Typography variant="body2">{Math.round(c.score)}%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, c.score))} sx={{ height: 8, borderRadius: 1 }} />
                </Box>
              ))}
            </Stack>
          </Paper>
        )}

        {/* 점수 산정 근거 */}
        {rationale.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>점수 산정 근거</Typography>
            <List dense>
              {rationale.map((r, idx) => (
                <ListItem key={idx} disableGutters>
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    <InfoIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={<Typography variant="body2">{r}</Typography>} />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {/* 위험 요소 플래그 */}
        {flags.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>위험 요소</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {flags.map((f, idx) => (
                <Tooltip key={idx} title={f.description || ''} arrow>
                  <Chip
                    icon={<FlagIcon />}
                    label={f.label}
                    color={f.level === 'HIGH' ? 'error' : f.level === 'MEDIUM' ? 'warning' : 'success'}
                    size="small"
                  />
                </Tooltip>
              ))}
            </Stack>
          </Paper>
        )}

        {/* 추가 정보 */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>추가 정보</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
            {previousHistory.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}><HistoryIcon fontSize="small" /> 이전 KYC 이력</Typography>
                <List dense>
                  {previousHistory.map((h, i) => (
                    <ListItem key={i} disableGutters>
                      <ListItemText
                        primary={<Typography variant="body2">{h.status} • {new Date(h.date).toLocaleString('ko-KR')}</Typography>}
                        secondary={h.note}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            {relatedAddresses.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>관련 지갑 주소</Typography>
                <Stack spacing={0.5}>
                  {relatedAddresses.map((a, i) => (
                    <AddressDisplay key={i} address={a} size="small" />
                  ))}
                </Stack>
              </Box>
            )}
            {tradingPatterns.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>거래 패턴 분석</Typography>
                <List dense>
                  {tradingPatterns.map((p, i) => (
                    <ListItem key={i} disableGutters>
                      <ListItemText primary={<Typography variant="body2">{p}</Typography>} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            {externalMatches.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>외부 DB 매칭 결과</Typography>
                <List dense>
                  {externalMatches.map((m, i) => (
                    <ListItem key={i} disableGutters>
                      <ListItemText
                        primary={<Typography variant="body2">{m.source}: {m.matched ? '매칭됨' : '미매칭'}</Typography>}
                        secondary={m.note}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    </Drawer>
  );
}


