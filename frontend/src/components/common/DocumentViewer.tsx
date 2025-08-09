import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Stack,
  IconButton,
  Tooltip,
  Typography,
  Skeleton,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import GetAppIcon from '@mui/icons-material/GetApp';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InfoIcon from '@mui/icons-material/Info';

export interface DocumentItem {
  id: string;
  name: string;
  url: string;
  type?: 'image' | 'pdf';
  sizeBytes?: number;
  uploadedAt?: string; // ISO
}

export interface DocumentViewerProps {
  documents: DocumentItem[];
  initialIndex?: number;
}

function detectType(url: string): 'image' | 'pdf' {
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image';
  // fallback: try guessing by URL params otherwise assume image
  return 'image';
}

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export default function DocumentViewer({ documents, initialIndex = 0 }: DocumentViewerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, documents.length - 1)));
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLImageElement | HTMLObjectElement | null>(null);
  const imgNatural = useRef<{ w: number; h: number } | null>(null);

  const doc = documents[index];
  const docType = (doc?.type || detectType(doc?.url || '')) as 'image' | 'pdf';

  useEffect(() => {
    // reset per-doc state
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setLoading(true);
    setError(false);
    imgNatural.current = null;
  }, [index]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(s => Math.max(0.2, Math.min(5, +(s + delta).toFixed(2))));
  }, []);

  const handleDoubleClick = useCallback(() => {
    // fit-to-screen for images
    if (docType === 'image' && containerRef.current && imgNatural.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const { w, h } = imgNatural.current;
      const fitScale = Math.min(cw / w, ch / h) * 0.98;
      setScale(prev => (Math.abs(prev - fitScale) < 0.01 ? 1 : +(fitScale.toFixed(2))));
      setOffset({ x: 0, y: 0 });
    } else {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [docType]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (docType !== 'image') return;
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const endDrag = () => setDragging(false);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const rotateLeft = () => setRotation(r => (r - 90 + 360) % 360);
  const rotateRight = () => setRotation(r => (r + 90) % 360);
  const zoomIn = () => setScale(s => Math.min(5, +(s + 0.1).toFixed(2)));
  const zoomOut = () => setScale(s => Math.max(0.2, +(s - 0.1).toFixed(2)));

  const goPrev = () => setIndex(i => Math.max(0, i - 1));
  const goNext = () => setIndex(i => Math.min(documents.length - 1, i + 1));

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoading(false);
    setError(false);
    const img = e.currentTarget;
    imgNatural.current = { w: img.naturalWidth, h: img.naturalHeight };
  };

  const onObjLoad = () => {
    setLoading(false);
    setError(false);
  };

  const onError = () => {
    setLoading(false);
    setError(true);
  };

  const infoText = useMemo(() => {
    return `${doc?.name || '-'} • ${formatBytes(doc?.sizeBytes)} • ${doc?.uploadedAt ? new Date(doc.uploadedAt).toLocaleString('ko-KR') : '-'}`;
  }, [doc]);

  return (
    <Box>
      {/* Tabs for documents */}
      <Tabs
        value={index}
        onChange={(_, v) => setIndex(v)}
        variant={isMobile ? 'scrollable' : 'standard'}
        scrollButtons={isMobile ? 'auto' : false}
        sx={{ mb: 1 }}
      >
        {documents.map((d, i) => (
          <Tab
            key={d.id || i}
            value={i}
            icon={d.type === 'pdf' || detectType(d.url) === 'pdf' ? <PictureAsPdfIcon fontSize="small" /> : <ImageIcon fontSize="small" />}
            iconPosition="start"
            label={d.name}
          />
        ))}
      </Tabs>

      {/* Toolbar */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Tooltip title="이전 문서"><span><IconButton size="small" onClick={goPrev} disabled={index === 0}><NavigateBeforeIcon /></IconButton></span></Tooltip>
        <Tooltip title="다음 문서"><span><IconButton size="small" onClick={goNext} disabled={index >= documents.length - 1}><NavigateNextIcon /></IconButton></span></Tooltip>
        <Box sx={{ mx: 1 }} />
        <Tooltip title="확대"><IconButton size="small" onClick={zoomIn}><ZoomInIcon /></IconButton></Tooltip>
        <Tooltip title="축소"><IconButton size="small" onClick={zoomOut}><ZoomOutIcon /></IconButton></Tooltip>
        <Tooltip title="왼쪽으로 회전"><IconButton size="small" onClick={rotateLeft}><RotateLeftIcon /></IconButton></Tooltip>
        <Tooltip title="오른쪽으로 회전"><IconButton size="small" onClick={rotateRight}><RotateRightIcon /></IconButton></Tooltip>
        <Tooltip title={isFullscreen ? '전체화면 종료' : '전체화면'}><IconButton size="small" onClick={toggleFullscreen}>{isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}</IconButton></Tooltip>
        <Box sx={{ mx: 1 }} />
        <Tooltip title="다운로드">
          <IconButton size="small" component="a" href={doc?.url} download={doc?.name} target="_blank" rel="noopener noreferrer">
            <GetAppIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ ml: 'auto' }} />
        <InfoIcon fontSize="small" color="disabled" />
        <Typography variant="caption" color="text.secondary" noWrap maxWidth={isMobile ? 160 : 380}>{infoText}</Typography>
      </Stack>

      {/* Viewer area */}
      <Box
        ref={containerRef}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        sx={{
          position: 'relative',
          height: 420,
          bgcolor: 'background.paper',
          borderRadius: 1,
          overflow: 'hidden',
          userSelect: dragging ? 'none' : 'auto',
          cursor: dragging ? 'grabbing' : docType === 'image' ? 'grab' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {loading && (
          <Skeleton variant="rectangular" width="100%" height="100%" />
        )}
        {!loading && error && (
          <Stack spacing={1} alignItems="center" color="text.secondary">
            <ImageIcon />
            <Typography variant="body2">문서를 불러오지 못했습니다.</Typography>
          </Stack>
        )}
        {!loading && !error && doc && (
          docType === 'image' ? (
            <img
              ref={el => (contentRef.current = el as any)}
              src={doc.url}
              alt={doc.name}
              onLoad={onImgLoad}
              onError={onError}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
                transformOrigin: 'center center',
                maxWidth: '100%',
                maxHeight: '100%',
                pointerEvents: 'none',
              }}
            />
          ) : (
            <object
              ref={el => (contentRef.current = el as any)}
              data={doc.url}
              type="application/pdf"
              onLoad={onObjLoad}
              onError={onError}
              style={{
                width: '100%',
                height: '100%',
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
                transformOrigin: 'center center',
              }}
            >
              <Box textAlign="center" p={2}>
                <Typography variant="body2">PDF 미리보기를 지원하지 않는 브라우저입니다. <a href={doc.url} target="_blank" rel="noreferrer">다운로드</a>하여 확인하세요.</Typography>
              </Box>
            </object>
          )
        )}
      </Box>
    </Box>
  );
}


