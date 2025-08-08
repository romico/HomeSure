import React, { useState, useEffect } from 'react';
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
  const [currentTab, setCurrentTab] = useState<'pending' | 'history' | 'stats'>('pending');
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

  useEffect(() => {
    loadData();
  }, [currentTab]);

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

  const handleViewDetail = async (applicationId: string) => {
    try {
      const detail = await adminKYCService.getApplicationDetail(applicationId);
      setSelectedApplication(detail);
    } catch (error) {
      showToast('error', '상세 정보를 불러오는 중 오류가 발생했습니다.');
    }
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
        <div className="flex space-x-2">
          <Button
            onClick={() => setCurrentTab('pending')}
            variant={currentTab === 'pending' ? 'primary' : 'outline'}
          >
            <Clock className="w-4 h-4 mr-2" />
            대기 중
          </Button>
          <Button
            onClick={() => setCurrentTab('history')}
            variant={currentTab === 'history' ? 'primary' : 'outline'}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            이력
          </Button>
          <Button
            onClick={() => setCurrentTab('stats')}
            variant={currentTab === 'stats' ? 'primary' : 'outline'}
          >
            <Users className="w-4 h-4 mr-2" />
            통계
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {currentTab === 'pending' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>대기 중인 KYC 신청 ({pendingApplications.length}건)</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingApplications.length === 0 ? (
                <p className="text-gray-500 text-center py-8">대기 중인 신청이 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  {pendingApplications.map((app) => (
                    <div key={app.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <h3 className="font-semibold text-lg">{app.applicantName}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${adminKYCService.getRiskLevelColor(app.riskLevel)}`}>
                              {app.riskLevel} 위험도
                            </span>
                            <span className="text-sm text-gray-500">점수: {app.riskScore}</span>
                          </div>
                          <p className="text-gray-600 mt-1">
                            {app.userAddress.substring(0, 10)}...{app.userAddress.substring(app.userAddress.length - 8)}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {adminKYCService.getDocumentTypeLabel(app.documentType)} • 
                            신청일: {adminKYCService.formatDate(app.submittedAt)}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleViewDetail(app.id)}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          상세보기
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>KYC 처리 이력</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{item.applicantName}</h3>
                      <p className="text-sm text-gray-600">
                        {item.userAddress.substring(0, 10)}...{item.userAddress.substring(item.userAddress.length - 8)}
                      </p>
                      <p className="text-xs text-gray-500">
                        신청: {adminKYCService.formatDate(item.submittedAt)} • 
                        처리: {adminKYCService.formatDate(item.processedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${adminKYCService.getStatusColor(item.status)}`}>
                        {item.status === 'APPROVED' ? '승인' : item.status === 'REJECTED' ? '거부' : '대기'}
                      </span>
                      {item.kycLevel && (
                        <p className="text-xs text-gray-500 mt-1">{item.kycLevel}</p>
                      )}
                      {item.reason && (
                        <p className="text-xs text-red-500 mt-1">{item.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {currentTab === 'stats' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">총 신청</p>
                  <p className="text-2xl font-bold">{stats.totalApplications}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">대기 중</p>
                  <p className="text-2xl font-bold">{stats.pendingApplications}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">승인률</p>
                  <p className="text-2xl font-bold">{stats.approvalRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">평균 처리시간</p>
                  <p className="text-2xl font-bold">{stats.averageProcessingTime}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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