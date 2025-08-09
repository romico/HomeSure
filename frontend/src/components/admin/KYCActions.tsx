import React, { useMemo, useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Select, Stack, TextField, Typography, Snackbar, Alert } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { adminKYCService } from '../../services/adminKYCService';

export interface KYCActionsProps {
  applicationId: string;
  defaultKycLevel?: string;
}

const TEMPLATES: string[] = [
  '서류 정보 불일치로 인해 거절되었습니다.',
  '제출된 문서의 유효기간이 만료되었습니다.',
  '추가 서류가 필요합니다. 지원서에 기입된 이메일로 안내드렸습니다.',
  '부정확한 정보가 확인되어 거절 처리합니다.',
];

const MAX_LEN = 500;

export default function KYCActions({ applicationId, defaultKycLevel = 'BASIC' }: KYCActionsProps) {
  const [comment, setComment] = useState('');
  const [template, setTemplate] = useState('');
  const [confirmOpen, setConfirmOpen] = useState<null | 'approve' | 'reject'>(null);
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; type: 'success' | 'error'; msg: string }>({ open: false, type: 'success', msg: '' });
  const navigate = useNavigate();

  const combinedComment = useMemo(() => {
    const parts = [] as string[];
    if (template) parts.push(template);
    if (comment.trim()) parts.push(comment.trim());
    return parts.join('\n');
  }, [template, comment]);

  const remaining = MAX_LEN - combinedComment.length;

  const handleTemplateChange = (value: string) => {
    setTemplate(value);
  };

  const openConfirm = (type: 'approve' | 'reject') => {
    if (type === 'reject' && combinedComment.trim().length === 0) {
      setSnack({ open: true, type: 'error', msg: '거절 사유를 입력하세요.' });
      return;
    }
    if (combinedComment.length > MAX_LEN) {
      setSnack({ open: true, type: 'error', msg: `코멘트는 최대 ${MAX_LEN}자까지 가능합니다.` });
      return;
    }
    setConfirmOpen(type);
  };

  const handleConfirm = async () => {
    if (!confirmOpen) return;
    try {
      setSubmitting(true);
      if (confirmOpen === 'approve') {
        await adminKYCService.approveApplication(applicationId, {
          adminNotes: combinedComment || undefined,
          kycLevel: defaultKycLevel,
          notifyEmail: sendEmail,
        } as any);
      } else {
        await adminKYCService.rejectApplication(applicationId, {
          reason: combinedComment || '사유 미기재',
          adminNotes: combinedComment || undefined,
          notifyEmail: sendEmail,
        } as any);
      }
      setSnack({ open: true, type: 'success', msg: '처리가 완료되었습니다.' });
      setConfirmOpen(null);
      // 처리 내역은 서버에서 기록된다고 가정. 이메일 발송은 옵션 값 전달 미지원 시 서버 기본 정책 사용.
      setTimeout(() => navigate('/admin/kyc/pending'), 800);
    } catch (e) {
      setSnack({ open: true, type: 'error', msg: '처리 중 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button variant="contained" color="success" startIcon={<CheckIcon />} onClick={() => openConfirm('approve')} disabled={submitting}>
            승인
          </Button>
          <Button variant="contained" color="error" startIcon={<CloseIcon />} onClick={() => openConfirm('reject')} disabled={submitting}>
            거절
          </Button>
          <FormControlLabel
            control={<Checkbox checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />}
            label="이메일 알림"
          />
        </Stack>

        <Stack spacing={1}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Select
              size="small"
              displayEmpty
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value as string)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value=""><em>코멘트 템플릿 선택</em></MenuItem>
              {TEMPLATES.map((t, idx) => (
                <MenuItem key={idx} value={t}>{t}</MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color={remaining < 0 ? 'error.main' : 'text.secondary'}>
              {remaining < 0 ? `초과 ${-remaining}자` : `남은 글자 수 ${remaining}자`}
            </Typography>
          </Stack>
          <TextField
            label="코멘트"
            placeholder="승인/거절 사유를 입력하세요"
            multiline
            minRows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            helperText="거절 시 코멘트가 필수입니다."
          />
          <Box>
            <Typography variant="caption" color="text.secondary">미리보기</Typography>
            <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap' }}>
              <Typography variant="body2">{combinedComment || '-'}</Typography>
            </Box>
          </Box>
        </Stack>
      </Stack>

      <Dialog open={!!confirmOpen} onClose={() => setConfirmOpen(null)}>
        <DialogTitle>{confirmOpen === 'approve' ? '승인 처리 확인' : '거절 처리 확인'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {confirmOpen === 'approve' ? '해당 신청을 승인하시겠습니까?' : '해당 신청을 거절하시겠습니까?'}
          </Typography>
          <Typography variant="caption" color="text.secondary">코멘트</Typography>
          <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap' }}>
            <Typography variant="body2">{combinedComment || '-'}</Typography>
          </Box>
          {sendEmail && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              이메일 알림이 전송됩니다.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(null)} disabled={submitting}>취소</Button>
          <Button onClick={handleConfirm} variant="contained" color={confirmOpen === 'approve' ? 'success' : 'error'} disabled={submitting}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={1500} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.type} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}


