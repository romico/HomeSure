import React, { useMemo, useState } from 'react';
import { Stack, Tooltip, IconButton, Link, Snackbar, Alert, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { isAddress } from 'ethers';

export interface AddressDisplayProps {
  address: string;
  explorerBaseUrl?: string; // e.g., https://etherscan.io/address/
  shortenStart?: number; // default 6 -> 0x123456...abcd
  shortenEnd?: number;   // default 4
  showCopy?: boolean;
  showExplorer?: boolean;
  size?: 'small' | 'medium'; // for table cell density
}

export default function AddressDisplay({
  address,
  explorerBaseUrl = 'https://etherscan.io/address/',
  shortenStart = 6,
  shortenEnd = 4,
  showCopy = true,
  showExplorer = true,
  size = 'small',
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const valid = useMemo(() => isAddress(address || ''), [address]);
  const short = useMemo(() => {
    if (!address) return '';
    const start = address.slice(0, Math.max(2 + shortenStart, 2));
    const end = address.slice(-shortenEnd);
    return `${start}...${end}`;
  }, [address, shortenStart, shortenEnd]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {}
  };

  const fontSize = size === 'small' ? 12 : 14;

  if (!valid) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
        <ErrorOutlineIcon color="error" fontSize="small" />
        <Tooltip title={address || '잘못된 주소'}>
          <Typography variant="body2" color="error" noWrap sx={{ fontFamily: 'monospace', fontSize }}>
            Invalid address
          </Typography>
        </Tooltip>
      </Stack>
    );
  }

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0, maxWidth: '100%' }}>
        <Tooltip title={address} arrow>
          <Typography
            variant="body2"
            noWrap
            sx={{ fontFamily: 'monospace', fontSize, maxWidth: '100%' }}
          >
            {short}
          </Typography>
        </Tooltip>
        {showCopy && (
          <IconButton size="small" aria-label="copy address" onClick={handleCopy} className="touch-target">
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        )}
        {showExplorer && (
          <Tooltip title="블록 탐색기에서 보기" arrow>
            <Link
              href={`${explorerBaseUrl}${address}`}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
            >
              <IconButton size="small" aria-label="open in explorer">
                <OpenInNewIcon fontSize="inherit" />
              </IconButton>
            </Link>
          </Tooltip>
        )}
      </Stack>

      <Snackbar open={copied} autoHideDuration={1500} onClose={() => setCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
          주소가 복사되었습니다
        </Alert>
      </Snackbar>
    </>
  );
}


