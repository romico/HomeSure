import React from 'react';
import { Chip, Stack, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

export type KYCStatus = 'APPROVED' | 'REJECTED' | 'PENDING';

export interface KYCStatusCommentProps {
  status: KYCStatus;
  comment?: string | null;
  show?: 'both' | 'status' | 'comment';
  size?: 'small' | 'medium';
  lines?: number; // max lines for comment ellipsis
}

function getStatusChip(status: KYCStatus, size: 'small' | 'medium') {
  if (status === 'APPROVED') {
    return <Chip size={size} color="success" icon={<CheckCircleIcon />} label="승인" />;
  }
  if (status === 'REJECTED') {
    return <Chip size={size} color="error" icon={<CancelIcon />} label="거절" />;
  }
  return <Chip size={size} color="warning" icon={<AccessTimeIcon />} label="보류" />;
}

export default function KYCStatusComment({ status, comment, show = 'both', size = 'small', lines = 2 }: KYCStatusCommentProps) {
  const content = (comment ?? '').trim();
  const displayText = content.length > 0 ? content : '-';

  const commentNode = (
    <Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{displayText}</span>} arrow>
      <Typography
        variant={size === 'small' ? 'body2' : 'body1'}
        sx={{
          display: '-webkit-box',
          WebkitLineClamp: lines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'normal',
        }}
      >
        {displayText}
      </Typography>
    </Tooltip>
  );

  if (show === 'status') {
    return getStatusChip(status, size);
  }

  if (show === 'comment') {
    return commentNode;
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      {getStatusChip(status, size)}
      {commentNode}
    </Stack>
  );
}


