import React, { useState, useEffect, useMemo } from 'react';
import { 
  adminKYCService, 
  PendingKYCApplication, 
  KYCApplicationDetail, 
  KYCHistoryItem, 
  KYCStats,
  ApprovalRequest,
  RejectionRequest
} from '../../services/adminKYCService';
import Card, { CardContent, CardHeader, CardTitle } from '../common/Card';
import Button from '../common/Button';
import Toast from '../common/Toast';
import { CheckCircle, XCircle, Eye, Clock, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { Box, Tabs, Tab, Badge, useMediaQuery, Fade, TextField, InputAdornment, IconButton, Select, MenuItem, FormControl, InputLabel, Chip, Stack, Tooltip, FormControlLabel, Switch } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar, GridToolbarContainer, GridToolbarColumnsButton, GridToolbarFilterButton, GridToolbarDensitySelector, GridToolbarExport } from '@mui/x-data-grid';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import BadgeIcon from '@mui/icons-material/Badge';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import RiskScoreChip from './RiskScoreChip';
import AddressDisplay from '../common/AddressDisplay';
import KYCStatsCards from './KYCStatsCards';
import ApprovalRateDonut from './ApprovalRateDonut';
import { useTheme } from '@mui/material/styles';
import { useLocation, useNavigate, Link } from 'react-router-dom';

interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

const KYCDashboard: React.FC = () => {
  const [pendingApplications, setPendingApplications] = useState<PendingKYCApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<KYCApplicationDetail | null>(null);
  const [history, setHistory] = useState<KYCHistoryItem[]>([]);
  const [stats, setStats] = useState<KYCStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();

  const pathTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (last === 'pending' || last === 'history' || last === 'stats') return last as 'pending' | 'history' | 'stats';
    return 'pending' as const;
  }, [location.pathname]);

  const [currentTab, setCurrentTab] = useState<'pending' | 'history' | 'stats'>(pathTab);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [approvalData, setApprovalData] = useState<ApprovalRequest>({
    adminNotes: '',
    kycLevel: 'BASIC',
    limits: {
      dailyLimit: '1000000',
      monthlyLimit: '10000000',
      totalLimit: '50000000'
    }
  });
  const [rejectionData, setRejectionData] = useState<RejectionRequest>({
    reason: '',
    adminNotes: ''
  });

  // Pending tab UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH'>('ALL');
  const [docFilter, setDocFilter] = useState<'ALL' | 'PASSPORT' | 'DRIVERS_LICENSE' | 'NATIONAL_ID' | string>('ALL');
  const [pageSize, setPageSize] = useState<number>(10);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  // 스와이프 네비게이션은 추후 필요 시 재도입

  const [historyPageSize, setHistoryPageSize] = useState<number>(25);
  const [historySelection, setHistorySelection] = useState<string[]>([]);
  const [historyFilters, setHistoryFilters] = useState<{ status?: string; processor?: string; from?: string; to?: string }>({});

  useEffect(() => {
    loadData();
  }, [currentTab]);

  useEffect(() => {
    // URL 변경 시 탭 동기화
    setCurrentTab(pathTab);
  }, [pathTab]);

  // URL 업데이트는 각 Tab에 Link를 부여하여 처리

  const loadData = async () => {
    setLoading(true);
    try {
      switch (currentTab) {
        case 'pending':
          const pendingData = await adminKYCService.getPendingApplications();
          setPendingApplications(pendingData.applications);
          break;
        case 'history':
          const historyData = await adminKYCService.getHistory();
          setHistory(historyData.history);
          break;
        case 'stats':
          const statsData = await adminKYCService.getStats();
          setStats(statsData);
          break;
      }
    } catch (error) {
      showToast('error', '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Auto refresh for pending tab
  useEffect(() => {
    if (currentTab !== 'pending' || !autoRefresh) return;
    const id = setInterval(() => {
      loadData();
    }, 30000); // 30s
    return () => clearInterval(id);
  }, [currentTab, autoRefresh]);

  const documentIcon = (docType: string) => {
    switch ((docType || '').toUpperCase()) {
      case 'PASSPORT':
        return <AssignmentIndIcon fontSize="small" sx={{ mr: 0.5 }} />;
      case 'DRIVERS_LICENSE':
        return <CreditCardIcon fontSize="small" sx={{ mr: 0.5 }} />;
      case 'NATIONAL_ID':
        return <BadgeIcon fontSize="small" sx={{ mr: 0.5 }} />;
      default:
        return <AssignmentIndIcon fontSize="small" sx={{ mr: 0.5 }} />;
    }
  };

  const CustomToolbar = () => (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport csvOptions={{ utf8WithBom: true, fileName: 'kyc_history' }} />
    </GridToolbarContainer>
  );

  const filteredPending = useMemo(() => {
    return (pendingApplications || []).filter((app) => {
      const q = (searchQuery || '').toLowerCase();
      const name = (app?.applicantName || '').toLowerCase();
      const addr = (app?.userAddress || '').toLowerCase();
      const risk = (app?.riskLevel || '').toUpperCase();
      const doc = (app?.documentType || '').toUpperCase();
      const matchQuery = !q || name.includes(q) || addr.includes(q);
      const matchRisk = riskFilter === 'ALL' || risk === riskFilter;
      const matchDoc = docFilter === 'ALL' || doc === docFilter;
      return matchQuery && matchRisk && matchDoc;
    });
  }, [pendingApplications, searchQuery, riskFilter, docFilter]);

  const pendingColumns: GridColDef[] = [
    {
      field: 'applicantName',
      headerName: '이름',
      flex: 1,
      minWidth: 150,
      sortable: true,
      renderCell: (params: any) => (
        <span>{params?.row?.applicantName ?? '-'}</span>
      ),
    },
    {
      field: 'riskScore',
      headerName: '위험도 점수',
      width: 150,
      sortable: true,
      sortComparator: (v1, v2) => Number(v1) - Number(v2),
        renderCell: (params: any) => (
        <RiskScoreChip
          score={Number(params?.row?.riskScore ?? 0)}
          breakdown={params?.row?.riskBreakdown}
          trend={params?.row?.riskTrend}
        />
      )
    },
    {
      field: 'userAddress',
      headerName: '지갑 주소',
      flex: 1,
      minWidth: 220,
      sortable: false,
      renderCell: (params: any) => (
        <AddressDisplay address={params?.row?.userAddress ?? ''} size="small" />
      )
    },
    {
      field: 'documentType',
      headerName: '문서 타입',
      flex: 1,
      minWidth: 160,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center">
          {documentIcon(params?.row?.documentType ?? '')}
          <span>{adminKYCService.getDocumentTypeLabel(params?.row?.documentType ?? '')}</span>
        </Stack>
      )
    },
    {
      field: 'submittedAt',
      headerName: '신청일',
      width: 180,
      sortable: true,
      valueGetter: (params: any) => {
        const ts = params?.row?.submittedAt;
        return ts ? new Date(ts).getTime() : 0;
      },
      renderCell: (params: any) => (
        <span>{params?.row?.submittedAt ? adminKYCService.formatDate(params.row.submittedAt) : '-'}</span>
      )
    },
    {
      field: 'actions',
      headerName: '액션',
      width: 140,
      sortable: false,
      renderCell: (params: any) => (
        <Button onClick={() => params?.row?.id && handleViewDetail(params.row.id)} variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-2" /> 상세보기
        </Button>
      )
    }
  ];

  const handleViewDetail = async (applicationId: string) => {
    navigate(`/admin/kyc/application/${applicationId}`);
  };

  const handleApprove = async () => {
    if (!selectedApplication) return;
    
    try {
      setLoading(true);
      await adminKYCService.approveApplication(selectedApplication.id, approvalData);
      showToast('success', 'KYC 신청이 성공적으로 승인되었습니다.');
      setShowApprovalModal(false);
      setSelectedApplication(null);
      loadData();
    } catch (error) {
      showToast('error', '승인 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication) return;
    
    try {
      setLoading(true);
      await adminKYCService.rejectApplication(selectedApplication.id, rejectionData);
      showToast('success', 'KYC 신청이 거부되었습니다.');
      setShowRejectionModal(false);
      setSelectedApplication(null);
      loadData();
    } catch (error) {
      showToast('error', '거부 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('ko-KR').format(parseInt(amount));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">KYC 관리 대시보드</h1>
      </div>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={currentTab}
          onChange={(_: any, v: 'pending'|'history'|'stats') => setCurrentTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          aria-label="KYC dashboard tabs"
        >
          <Tab
            value="pending"
            id="kyc-tab-pending"
            aria-controls="kyc-tabpanel-pending"
            label={<Badge color="secondary" badgeContent={pendingApplications.length} max={999} showZero>대기 중</Badge>}
            icon={<Clock className="w-4 h-4" />}
            iconPosition="start"
            component={Link}
            to="/admin/kyc/pending"
          />
          <Tab
            value="history"
            id="kyc-tab-history"
            aria-controls="kyc-tabpanel-history"
            label={<Badge color="secondary" badgeContent={history.length} max={999} showZero>이력</Badge>}
            icon={<TrendingUp className="w-4 h-4" />}
            iconPosition="start"
            component={Link}
            to="/admin/kyc/history"
          />
          <Tab
            value="stats"
            id="kyc-tab-stats"
            aria-controls="kyc-tabpanel-stats"
            label={'통계'}
            icon={<Users className="w-4 h-4" />}
            iconPosition="start"
            component={Link}
            to="/admin/kyc/stats"
          />
        </Tabs>
      </Box>

      {loading && (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      <Fade in={currentTab === 'pending'} mountOnEnter unmountOnExit>
        <div role="tabpanel" id="kyc-tabpanel-pending" aria-labelledby="kyc-tab-pending">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>대기 중인 KYC 신청 ({filteredPending.length}건)</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    size="small"
                    label="검색 (이름/지갑)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">🔎</InputAdornment>
                    }}
                  />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id="risk-filter-label">위험도</InputLabel>
                    <Select labelId="risk-filter-label" label="위험도" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as any)}>
                      <MenuItem value="ALL">전체</MenuItem>
                      <MenuItem value="LOW">낮음</MenuItem>
                      <MenuItem value="MEDIUM">중간</MenuItem>
                      <MenuItem value="HIGH">높음</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="doc-filter-label">문서 타입</InputLabel>
                    <Select labelId="doc-filter-label" label="문서 타입" value={docFilter} onChange={(e) => setDocFilter(e.target.value)}>
                      <MenuItem value="ALL">전체</MenuItem>
                      <MenuItem value="PASSPORT">여권</MenuItem>
                      <MenuItem value="DRIVERS_LICENSE">운전면허증</MenuItem>
                      <MenuItem value="NATIONAL_ID">주민등록증</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
                    label="자동 새로고침"
                  />
                </Stack>

                <div style={{ width: '100%' }}>
                  <DataGrid
                    autoHeight
                    rows={(filteredPending || []).filter((r) => r && r.id) as any}
                    columns={pendingColumns as any}
                    getRowId={(row: any) => row?.id}
                    loading={loading}
                    pageSizeOptions={[10, 25, 50, 100]}
                    pagination
                    initialState={{ pagination: { paginationModel: { pageSize } } }}
                    onPaginationModelChange={(model: any) => setPageSize(model.pageSize)}
                    disableRowSelectionOnClick
                    sx={{ '& .MuiDataGrid-cell:focus': { outline: 'none' } }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Fade>

      <Fade in={currentTab === 'history'} mountOnEnter unmountOnExit>
        <div role="tabpanel" id="kyc-tabpanel-history" aria-labelledby="kyc-tab-history">
          <Card>
            <CardHeader>
              <CardTitle>KYC 처리 이력</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField size="small" label="이름 검색" onChange={(e) => setSearchQuery(e.target.value)} />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="status-filter-label">상태</InputLabel>
                  <Select labelId="status-filter-label" label="상태" value={historyFilters.status || ''} onChange={(e) => setHistoryFilters((p) => ({ ...p, status: e.target.value }))}>
                    <MenuItem value="">전체</MenuItem>
                    <MenuItem value="APPROVED">승인</MenuItem>
                    <MenuItem value="REJECTED">거절</MenuItem>
                  </Select>
                </FormControl>
                <TextField size="small" type="text" label="처리자" value={historyFilters.processor || ''} onChange={(e) => setHistoryFilters((p) => ({ ...p, processor: e.target.value }))} />
                <TextField size="small" type="datetime-local" label="시작" InputLabelProps={{ shrink: true }} onChange={(e) => setHistoryFilters((p) => ({ ...p, from: e.target.value }))} />
                <TextField size="small" type="datetime-local" label="종료" InputLabelProps={{ shrink: true }} onChange={(e) => setHistoryFilters((p) => ({ ...p, to: e.target.value }))} />
              </Stack>

              <div style={{ width: '100%' }}>
                <DataGrid
                  autoHeight
                  rows={history.filter((h) => {
                    const matchName = !searchQuery || h.applicantName.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchStatus = !historyFilters.status || h.status === historyFilters.status;
                    const matchProcessor = !historyFilters.processor || (h.processedBy || '').toLowerCase().includes(historyFilters.processor.toLowerCase());
                    const from = historyFilters.from ? new Date(historyFilters.from).getTime() : null;
                    const to = historyFilters.to ? new Date(historyFilters.to).getTime() : null;
                    const processedAtTs = h.processedAt ? new Date(h.processedAt).getTime() : null;
                    const inRange = (!from || (processedAtTs && processedAtTs >= from)) && (!to || (processedAtTs && processedAtTs <= to));
                    return matchName && matchStatus && matchProcessor && inRange;
                  })}
                  getRowId={(row: any) => row.id}
                  columns={([
                    { field: 'applicantName', headerName: '이름', flex: 1, minWidth: 150, sortable: true },
                     { field: 'userAddress', headerName: '지갑 주소', flex: 1, minWidth: 220, sortable: false, renderCell: (params: any) => <AddressDisplay address={params.row.userAddress} size="small" /> },
                    {
                      field: 'submittedAt', headerName: '신청일', width: 180, sortable: true,
                      valueGetter: (p: any) => {
                        const v = p?.row?.submittedAt;
                        return v ? new Date(v).getTime() : 0;
                      },
                      renderCell: (p: any) => (
                        <span>{p?.row?.submittedAt ? new Date(p.row.submittedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('. ', '-').replace('. ', '-').replace('.','') : '-'}</span>
                      )
                    },
                    {
                      field: 'processedAt', headerName: '처리일', width: 180, sortable: true,
                      valueGetter: (p: any) => {
                        const v = p?.row?.processedAt;
                        return v ? new Date(v).getTime() : 0;
                      },
                      renderCell: (p: any) => (
                        <span>{p?.row?.processedAt ? new Date(p.row.processedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('. ', '-').replace('. ', '-').replace('.','') : '-'}</span>
                      )
                    },
                    {
                      field: 'status', headerName: '상태', width: 120, sortable: true,
                      renderCell: (p: any) => (
                        <Chip size="small" label={p.row.status === 'APPROVED' ? '승인' : '거절'} color={p.row.status === 'APPROVED' ? 'success' : 'error'} />
                      )
                    },
                    {
                      field: 'reason', headerName: '코멘트', flex: 1.2, minWidth: 200, sortable: false,
                      renderCell: (p: any) => (
                        <Tooltip title={p.row.reason || ''}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.reason || '-'}</span>
                        </Tooltip>
                      )
                    },
                    { field: 'processedBy', headerName: '처리자', width: 140, sortable: true, hide: true },
                  ]) as GridColDef[]}
                  checkboxSelection
                  onRowSelectionModelChange={(ids: any) => setHistorySelection(ids as string[])}
                  disableRowSelectionOnClick
                  pageSizeOptions={[10, 25, 50, 100]}
                  pagination
                  initialState={{ pagination: { paginationModel: { pageSize: historyPageSize } } }}
                  onPaginationModelChange={(m: any) => setHistoryPageSize(m.pageSize)}
                  slots={{ toolbar: CustomToolbar }}
                  sortingOrder={[ 'asc', 'desc' ]}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </Fade>

      <Fade in={currentTab === 'stats'} mountOnEnter unmountOnExit>
        <div role="tabpanel" id="kyc-tabpanel-stats" aria-labelledby="kyc-tab-stats">
          {stats && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <ApprovalRateDonut
                  percent={Number(stats.approvalRate) || 0}
                  approved={Number(stats.approvedApplications || 0)}
                  rejected={Number(stats.rejectedApplications || 0)}
                  goal={90}
                  trendLabel="주별"
                />
              </div>
              <KYCStatsCards stats={stats} />
            </div>
          )}
        </div>
      </Fade>

      {/* 승인 모달 */}
      {showApprovalModal && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">KYC 승인</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">관리자 노트</label>
                <textarea
                  value={approvalData.adminNotes}
                  onChange={(e) => setApprovalData({...approvalData, adminNotes: e.target.value})}
                  className="w-full border rounded-md p-2"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">KYC 레벨</label>
                <select
                  value={approvalData.kycLevel}
                  onChange={(e) => setApprovalData({...approvalData, kycLevel: e.target.value})}
                  className="w-full border rounded-md p-2"
                >
                  <option value="BASIC">기본</option>
                  <option value="ENHANCED">향상</option>
                  <option value="PREMIUM">프리미엄</option>
                </select>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleApprove} disabled={loading}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  승인
                </Button>
                <Button onClick={() => setShowApprovalModal(false)} variant="outline">
                  취소
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 거부 모달 */}
      {showRejectionModal && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">KYC 거부</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">거부 사유 *</label>
                <input
                  type="text"
                  value={rejectionData.reason}
                  onChange={(e) => setRejectionData({...rejectionData, reason: e.target.value})}
                  className="w-full border rounded-md p-2"
                  placeholder="거부 사유를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">관리자 노트</label>
                <textarea
                  value={rejectionData.adminNotes}
                  onChange={(e) => setRejectionData({...rejectionData, adminNotes: e.target.value})}
                  className="w-full border rounded-md p-2"
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleReject} disabled={loading || !rejectionData.reason}>
                  <XCircle className="w-4 h-4 mr-2" />
                  거부
                </Button>
                <Button onClick={() => setShowRejectionModal(false)} variant="outline">
                  취소
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상세 정보 모달 */}
      {selectedApplication && !showApprovalModal && !showRejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">KYC 신청 상세 정보</h3>
              <Button onClick={() => setSelectedApplication(null)} variant="outline" size="sm">
                닫기
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">신청자</label>
                  <p className="font-medium">{selectedApplication.applicantName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">지갑 주소</label>
                  <p className="font-mono text-sm">{selectedApplication.userAddress}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">이메일</label>
                  <p>{selectedApplication.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">전화번호</label>
                  <p>{selectedApplication.phone}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">생년월일</label>
                  <p>{selectedApplication.dateOfBirth}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">국적</label>
                  <p>{selectedApplication.nationality}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600">주소</label>
                <p>{adminKYCService.formatAddress(selectedApplication.address)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">문서 타입</label>
                  <p>{adminKYCService.getDocumentTypeLabel(selectedApplication.documentType)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">문서 번호</label>
                  <p>{selectedApplication.documentNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">위험도 점수</label>
                  <p className={`font-medium ${adminKYCService.getRiskLevelColor(selectedApplication.riskLevel)}`}>
                    {selectedApplication.riskScore}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">위험도 레벨</label>
                  <p className={`font-medium ${adminKYCService.getRiskLevelColor(selectedApplication.riskLevel)}`}>
                    {selectedApplication.riskLevel}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">KYC 레벨</label>
                  <p className="font-medium">{selectedApplication.kycLevel}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">AML 체크</label>
                  <p className={selectedApplication.amlCheck.isPassed ? 'text-green-600' : 'text-red-600'}>
                    {selectedApplication.amlCheck.isPassed ? '통과' : '실패'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">문서 검증</label>
                  <p className={selectedApplication.documentVerification.isVerified ? 'text-green-600' : 'text-red-600'}>
                    {selectedApplication.documentVerification.isVerified ? '검증됨' : '미검증'}
                  </p>
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button onClick={() => setShowApprovalModal(true)}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  승인
                </Button>
                <Button onClick={() => setShowRejectionModal(true)} variant="outline">
                  <XCircle className="w-4 h-4 mr-2" />
                  거부
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          id={toast.type}
          type={toast.type}
          title={toast.type === 'success' ? '성공' : '오류'}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default KYCDashboard; 