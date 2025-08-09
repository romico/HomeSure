import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
  Snackbar,
  Alert
} from '@mui/material';
// Grid 호환 이슈 회피: Box CSS 그리드로 대체
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import CakeIcon from '@mui/icons-material/Cake';
import PublicIcon from '@mui/icons-material/Public';
import PersonIcon from '@mui/icons-material/Person';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import { useNavigate, useParams } from 'react-router-dom';
import AddressDisplay from '../components/common/AddressDisplay';
import RiskScoreChip from '../components/admin/RiskScoreChip';
import KYCStatusComment, { KYCStatus } from '../components/admin/KYCStatusComment';
import ApprovalRateDonut from '../components/admin/ApprovalRateDonut';
import RiskAnalysisPanel, { RiskFlag } from '../components/admin/RiskAnalysisPanel';
import InfoIcon from '@mui/icons-material/Info';
import { adminKYCService, KYCApplicationDetail } from '../services/adminKYCService';
import DocumentViewer, { DocumentItem } from '../components/common/DocumentViewer';
import KYCActions from '../components/admin/KYCActions';
import { Timeline, TimelineConnector, TimelineContent, TimelineDot, TimelineItem, TimelineOppositeContent, TimelineSeparator } from '@mui/lab';

export default function KYCApplicationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<KYCApplicationDetail | null>(null);
  const [comment, setComment] = useState('');
  const [snack, setSnack] = useState<{ open: boolean; type: 'success' | 'error'; msg: string }>({ open: false, type: 'success', msg: '' });
  const [riskOpen, setRiskOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!id) return;
        setLoading(true);
        // 상세 조회
        const baseDetail = await adminKYCService.getApplicationDetail(id);
        // 대기 목록에서 같은 ID 매칭하여 누락/정적 필드 보정
        const pending = await adminKYCService.getPendingApplications();
        const match = (pending?.applications || []).find((a) => a.id === id);
        const merged = match
          ? {
              ...baseDetail,
              applicantName: match.applicantName ?? baseDetail.applicantName,
              userAddress: match.userAddress ?? baseDetail.userAddress,
              documentType: match.documentType ?? baseDetail.documentType,
              documentNumber: match.documentNumber ?? baseDetail.documentNumber,
              submittedAt: match.submittedAt ?? baseDetail.submittedAt,
              riskScore: String(match.riskScore ?? baseDetail.riskScore),
              riskLevel: match.riskLevel ?? baseDetail.riskLevel,
              kycLevel: match.kycLevel ?? baseDetail.kycLevel,
            }
          : baseDetail;
        if (mounted) setDetail(merged);
      } catch (e) {
        setSnack({ open: true, type: 'error', msg: '상세 정보를 불러오지 못했습니다.' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const status: KYCStatus = useMemo(() => {
    if (!detail) return 'PENDING';
    if ((detail as any).status === 'APPROVED') return 'APPROVED';
    if ((detail as any).status === 'REJECTED') return 'REJECTED';
    return 'PENDING';
  }, [detail]);

  const riskFlags: RiskFlag[] = useMemo(() => {
    if (!detail) return [];
    const flags: RiskFlag[] = [];
    if (!detail.amlCheck?.isPassed) {
      flags.push({ level: 'HIGH', label: 'AML 실패', description: '거래 위험도 높음' });
    }
    if (!detail.documentVerification?.isVerified) {
      flags.push({ level: 'MEDIUM', label: '문서 검증 미확인', description: '추가 검증 필요' });
    }
    return flags;
  }, [detail]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      await adminKYCService.approveApplication(id, { adminNotes: comment, kycLevel: detail?.kycLevel || 'BASIC' });
      setSnack({ open: true, type: 'success', msg: '승인되었습니다.' });
    } catch {
      setSnack({ open: true, type: 'error', msg: '승인 처리에 실패했습니다.' });
    }
  };

  const handleReject = async () => {
    if (!id) return;
    try {
      await adminKYCService.rejectApplication(id, { reason: comment || '사유 미기재', adminNotes: comment });
      setSnack({ open: true, type: 'success', msg: '거절되었습니다.' });
    } catch {
      setSnack({ open: true, type: 'error', msg: '거절 처리에 실패했습니다.' });
    }
  };

  const handleHold = async () => {
    // 보류 API가 없다면 여기서는 클라이언트 상태로 대체 표시
    setSnack({ open: true, type: 'success', msg: '보류 상태로 표시했습니다. (API 미구현)' });
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* 상단 바 */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} aria-label="back"><ArrowBackIcon /></IconButton>
        {loading ? (
          <Skeleton variant="text" width={200} />
        ) : (
          <Typography variant="h5" fontWeight={700}>{detail?.applicantName || '신청자'}</Typography>
        )}
        <Box sx={{ ml: 'auto' }} />
        {!loading && (
          <KYCStatusComment status={status} show="status" />
        )}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, gap: 2 }}>
        {/* 좌측 60% */}
        <Box>
          <Stack spacing={2}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>신청 정보</Typography>
                {loading || !detail ? (
                  <Skeleton variant="rectangular" height={160} />
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <Box>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center"><PersonIcon fontSize="small" /><Typography variant="body2">이름: {detail.applicantName}</Typography></Stack>
                        <Stack direction="row" spacing={1} alignItems="center"><CakeIcon fontSize="small" /><Typography variant="body2">생년월일: {detail.dateOfBirth}</Typography></Stack>
                        <Stack direction="row" spacing={1} alignItems="center"><PublicIcon fontSize="small" /><Typography variant="body2">국적: {detail.nationality}</Typography></Stack>
                      </Stack>
                    </Box>
                    <Box>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center"><EmailIcon fontSize="small" /><Typography variant="body2">이메일: {detail.email}</Typography></Stack>
                        <Stack direction="row" spacing={1} alignItems="center"><PhoneIcon fontSize="small" /><Typography variant="body2">전화번호: {detail.phone}</Typography></Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <GppMaybeIcon fontSize="small" />
                          <Typography variant="body2">지갑: </Typography>
                          <AddressDisplay address={detail.userAddress} />
                        </Stack>
                      </Stack>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>제출 문서</Typography>
                {loading || !detail ? (
                  <Skeleton variant="rectangular" height={120} />
                ) : (
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <DescriptionIcon fontSize="small" />
                      <Typography variant="body2">
                        {detail.documentType} • 번호: {detail.documentNumber} • 만료: {detail.documentExpiry}
                      </Typography>
                    </Stack>
                    <DocumentViewer
                      documents={[
                        {
                          id: 'main-doc',
                          name: `${detail.documentType} - ${detail.documentNumber}`,
                          url: (detail as any).documentUrl || '#',
                          type: (detail as any).documentUrl?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
                          sizeBytes: undefined,
                          uploadedAt: detail.submittedAt as any
                        } as DocumentItem
                      ]}
                    />
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Box>

        {/* 우측 40% */}
        <Box>
          <Stack spacing={2}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>위험도 분석</Typography>
                {loading || !detail ? (
                  <Skeleton variant="rectangular" height={180} />
                ) : (
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <RiskScoreChip score={Number(detail.riskScore) || 0} breakdown={detail as any} trend="flat" />
                      <Chip size="small" label={`레벨: ${detail.riskLevel}`} />
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" startIcon={<InfoIcon />} onClick={() => setRiskOpen(true)}>
                        자세히 보기
                      </Button>
                    </Stack>
                    <Divider />
{/*                     <ApprovalRateDonut percent={75} approved={120} rejected={25} goal={90} trendLabel="주별" />
 */}                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>액션</Typography>
                <KYCActions applicationId={id!} defaultKycLevel={detail?.kycLevel || 'BASIC'} />
              </CardContent>
            </Card>

            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>히스토리</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={160} />
                ) : (
                  <Timeline position="right">
                    <TimelineItem>
                      <TimelineOppositeContent color="text.secondary">제출</TimelineOppositeContent>
                      <TimelineSeparator>
                        <TimelineDot />
                        <TimelineConnector />
                      </TimelineSeparator>
                      <TimelineContent>
                        <Typography variant="body2">신청서 제출</Typography>
                        <Typography variant="caption" color="text.secondary">{detail?.submittedAt || '-'}</Typography>
                      </TimelineContent>
                    </TimelineItem>
                    <TimelineItem>
                      <TimelineOppositeContent color="text.secondary">검토</TimelineOppositeContent>
                      <TimelineSeparator>
                        <TimelineDot color="primary" />
                        <TimelineConnector />
                      </TimelineSeparator>
                      <TimelineContent>
                        <Typography variant="body2">서류 검토</Typography>
                        <Typography variant="caption" color="text.secondary">{detail?.estimatedProcessingTime || '-'}</Typography>
                      </TimelineContent>
                    </TimelineItem>
                    <TimelineItem>
                      <TimelineOppositeContent color="text.secondary">처리</TimelineOppositeContent>
                      <TimelineSeparator>
                        <TimelineDot color="success" />
                      </TimelineSeparator>
                      <TimelineContent>
                        <Typography variant="body2">처리 완료</Typography>
                        <Typography variant="caption" color="text.secondary">{(detail as any)?.processedAt || '-'}</Typography>
                      </TimelineContent>
                    </TimelineItem>
                  </Timeline>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={1500} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.type} variant="filled">{snack.msg}</Alert>
      </Snackbar>

      {/* 위험도 분석 패널 연결 */}
      <RiskAnalysisPanel
        open={riskOpen}
        onClose={() => setRiskOpen(false)}
        score={Number(detail?.riskScore || 0)}
        categories={detail ? [
          { name: '신원 확인', score: detail.documentVerification?.isVerified ? 90 : 50 },
          { name: '주소 확인', score: detail.address ? 80 : 50 },
          { name: '자금 출처', score: detail.amlCheck?.isPassed ? 75 : 40 },
        ] : []}
        rationale={detail ? [
          `문서 검증 ${detail.documentVerification?.isVerified ? '통과' : '미통과'}`,
          `AML 체크 ${detail.amlCheck?.isPassed ? '통과' : '실패'}`,
        ] : []}
        flags={riskFlags}
        previousHistory={[]}
        relatedAddresses={detail ? [detail.userAddress] : []}
        tradingPatterns={[]}
        externalMatches={[]}
      />
    </Box>
  );
}


