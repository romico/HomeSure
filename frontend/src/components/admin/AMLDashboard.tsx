import React, { useState, useEffect } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Toast from '../common/Toast';
import { 
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Search,
  Eye,
  Check,
  X
} from 'lucide-react';
import { adminApi, AMLAlert, AMLStats } from '../../services/adminApi';

const AMLDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<AMLAlert[]>([]);
  const [stats, setStats] = useState<AMLStats>({
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    resolved: 0,
    pending: 0,
    todayAlerts: 0,
    weeklyAlerts: 0,
    averageRiskScore: 0,
    resolutionRate: '0'
  });
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AMLAlert | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'details' | 'resolve' | 'escalate'>('details');
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 통계 카드 데이터
  const statCards = [
    { title: '전체 알림', value: stats.total, icon: AlertTriangle, color: 'text-red-600' },
    { title: '높은 위험', value: stats.high, icon: Shield, color: 'text-red-600' },
    { title: '중간 위험', value: stats.medium, icon: TrendingUp, color: 'text-yellow-600' },
    { title: '낮은 위험', value: stats.low, icon: Clock, color: 'text-green-600' },
    { title: '해결됨', value: stats.resolved, icon: CheckCircle, color: 'text-green-600' },
    { title: '해결률', value: `${stats.resolutionRate}%`, icon: TrendingUp, color: 'text-blue-600' }
  ];

  useEffect(() => {
    fetchAMLData();
  }, []);

  const fetchAMLData = async () => {
    try {
      setLoading(true);
      
      // API 호출
      const [alertsResponse, statsResponse] = await Promise.all([
        adminApi.getAMLAlerts({
          page: 1,
          limit: 20,
          severity: severityFilter !== 'ALL' ? severityFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchTerm || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }),
        adminApi.getAMLStats()
      ]);

      setAlerts(alertsResponse.data);
      setStats(statsResponse);
    } catch (error) {
      console.error('AML 데이터 조회 실패:', error);
      setToast({ type: 'error', message: 'AML 데이터를 불러오는데 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alert: AMLAlert, reason: string) => {
    try {
      await adminApi.resolveAMLAlert(alert.id, reason);
      
      setToast({ type: 'success', message: 'AML 알림이 해결되었습니다.' });
      setShowModal(false);
      setSelectedAlert(null);
      
      // 데이터 새로고침
      fetchAMLData();
    } catch (error) {
      console.error('AML 알림 해결 실패:', error);
      setToast({ type: 'error', message: 'AML 알림 해결에 실패했습니다.' });
    }
  };

  const handleEscalate = async (alert: AMLAlert, reason: string) => {
    try {
      await adminApi.escalateAMLAlert(alert.id, reason);
      
      setToast({ type: 'success', message: 'AML 알림이 에스컬레이션되었습니다.' });
      setShowModal(false);
      setSelectedAlert(null);
      
      // 데이터 새로고침
      fetchAMLData();
    } catch (error) {
      console.error('AML 알림 에스컬레이션 실패:', error);
      setToast({ type: 'error', message: 'AML 알림 에스컬레이션에 실패했습니다.' });
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = 
      alert.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.userAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === 'ALL' || alert.severity === severityFilter;
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'RESOLVED' ? alert.isResolved : !alert.isResolved);
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'text-red-600 bg-red-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (isResolved: boolean) => {
    return isResolved ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">AML 관리자 대시보드</h1>
        <div className="flex space-x-2">
          <Button onClick={fetchAMLData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button variant="outline" size="sm">
            <AlertTriangle className="h-4 w-4 mr-2" />
            보고서
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
                <card.icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 필터 및 검색 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="거래 ID, 주소, 설명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">모든 위험도</option>
                <option value="HIGH">높음</option>
                <option value="MEDIUM">중간</option>
                <option value="LOW">낮음</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">모든 상태</option>
                <option value="PENDING">대기 중</option>
                <option value="RESOLVED">해결됨</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 알림 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>AML 알림 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">거래 ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">사용자 주소</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">위험도</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">상태</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">위험 점수</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">발생일</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{alert.transactionId}</p>
                      <p className="text-sm text-gray-500">{alert.description}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-900 font-mono">{alert.userAddress}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(alert.isResolved)}`}>
                        {alert.isResolved ? '해결됨' : '대기 중'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-900">{alert.riskScore}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-900">{new Date(alert.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => {
                            setSelectedAlert(alert);
                            setModalType('details');
                            setShowModal(true);
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!alert.isResolved && (
                          <>
                            <Button
                              onClick={() => {
                                setSelectedAlert(alert);
                                setModalType('resolve');
                                setShowModal(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedAlert(alert);
                                setModalType('escalate');
                                setShowModal(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 모달 */}
      {showModal && selectedAlert && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={
            modalType === 'resolve' ? 'AML 알림 해결' :
            modalType === 'escalate' ? 'AML 알림 에스컬레이션' :
            '알림 상세 정보'
          }
          size="lg"
        >
          {modalType === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">거래 ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{selectedAlert.transactionId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">사용자 주소</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{selectedAlert.userAddress}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">위험도</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(selectedAlert.severity)}`}>
                    {selectedAlert.severity}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">위험 점수</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAlert.riskScore}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">상태</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedAlert.isResolved)}`}>
                    {selectedAlert.isResolved ? '해결됨' : '대기 중'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">발생일</label>
                  <p className="mt-1 text-sm text-gray-900">{new Date(selectedAlert.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">설명</label>
                <p className="mt-1 text-sm text-gray-900">{selectedAlert.description}</p>
              </div>
            </div>
          )}
          
          {modalType === 'resolve' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">해결 사유</label>
                <textarea
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="해결 사유를 입력하세요..."
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  취소
                </Button>
                <Button onClick={() => handleResolve(selectedAlert, '해결됨')}>
                  해결
                </Button>
              </div>
            </div>
          )}
          
          {modalType === 'escalate' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">에스컬레이션 사유</label>
                <textarea
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="에스컬레이션 사유를 입력하세요..."
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  취소
                </Button>
                <Button variant="destructive" onClick={() => handleEscalate(selectedAlert, '에스컬레이션됨')}>
                  에스컬레이션
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* 토스트 */}
      {toast && (
        <Toast
          id="aml-toast"
          type={toast.type}
          title={toast.type === 'success' ? '성공' : '오류'}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default AMLDashboard; 