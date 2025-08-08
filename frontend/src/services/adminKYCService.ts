import api from './api';

export interface PendingKYCApplication {
  id: string;
  userAddress: string;
  applicantName: string;
  documentType: string;
  documentNumber: string;
  submittedAt: string;
  status: string;
  riskScore: string;
  riskLevel: string;
  kycLevel: string;
  estimatedProcessingTime: string;
}

export interface KYCApplicationDetail {
  id: string;
  userAddress: string;
  applicantName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  documentExpiry: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  submittedAt: string;
  status: string;
  riskScore: string;
  riskLevel: string;
  kycLevel: string;
  amlCheck: {
    isPassed: boolean;
    riskFactors: string[];
    screeningResult: string;
  };
  documentVerification: {
    isVerified: boolean;
    confidence: number;
    verificationMethod: string;
  };
  estimatedProcessingTime: string;
  notes: string;
}

export interface ApprovalRequest {
  adminNotes?: string;
  kycLevel?: string;
  limits?: {
    dailyLimit: string;
    monthlyLimit: string;
    totalLimit: string;
  };
}

export interface RejectionRequest {
  reason: string;
  adminNotes?: string;
}

export interface ApprovalResult {
  applicationId: string;
  status: string;
  approvedAt: string;
  approvedBy: string;
  kycLevel: string;
  limits: {
    dailyLimit: string;
    monthlyLimit: string;
    totalLimit: string;
  };
  adminNotes: string;
  blockchainTransaction: {
    txHash: string;
    blockNumber: number;
    gasUsed: number;
  };
}

export interface RejectionResult {
  applicationId: string;
  status: string;
  rejectedAt: string;
  rejectedBy: string;
  reason: string;
  adminNotes: string;
  canReapply: boolean;
  reapplyAfter: string;
}

export interface KYCHistoryItem {
  id: string;
  userAddress: string;
  applicantName: string;
  status: string;
  submittedAt: string;
  processedAt: string;
  processedBy: string;
  kycLevel?: string;
  riskScore: string;
  reason?: string;
}

export interface KYCStats {
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  approvalRate: number;
  averageProcessingTime: string;
  todayApplications: number;
  todayApprovals: number;
  todayRejections: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  kycLevelDistribution: {
    basic: number;
    enhanced: number;
    premium: number;
  };
  timestamp: string;
}

class AdminKYCService {
  private baseUrl = '/api/admin/kyc';

  // 대기 중인 KYC 신청 목록 조회
  async getPendingApplications(): Promise<{
    applications: PendingKYCApplication[];
    totalCount: number;
    timestamp: string;
  }> {
    const response = await api.get(`${this.baseUrl}/pending`);
    return response.data;
  }

  // 특정 KYC 신청 상세 정보 조회
  async getApplicationDetail(applicationId: string): Promise<KYCApplicationDetail> {
    const response = await api.get(`${this.baseUrl}/${applicationId}`);
    return response.data;
  }

  // KYC 신청 승인
  async approveApplication(
    applicationId: string,
    approvalData: ApprovalRequest
  ): Promise<ApprovalResult> {
    const response = await api.post(`${this.baseUrl}/${applicationId}/approve`, approvalData);
    return response.data;
  }

  // KYC 신청 거부
  async rejectApplication(
    applicationId: string,
    rejectionData: RejectionRequest
  ): Promise<RejectionResult> {
    const response = await api.post(`${this.baseUrl}/${applicationId}/reject`, rejectionData);
    return response.data;
  }

  // KYC 승인/거부 이력 조회
  async getHistory(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    history: KYCHistoryItem[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);

    const response = await api.get(`${this.baseUrl}/history?${queryParams.toString()}`);
    return response.data;
  }

  // KYC 통계 정보 조회
  async getStats(): Promise<KYCStats> {
    const response = await api.get(`${this.baseUrl}/stats`);
    return response.data;
  }

  // 헬퍼 메서드들
  getStatusColor(status: string): string {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return 'text-green-600';
      case 'REJECTED':
        return 'text-red-600';
      case 'PENDING':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  }

  getRiskLevelColor(riskLevel: string): string {
    switch (riskLevel.toUpperCase()) {
      case 'LOW':
        return 'text-green-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'HIGH':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }

  getDocumentTypeLabel(documentType: string): string {
    switch (documentType.toUpperCase()) {
      case 'PASSPORT':
        return '여권';
      case 'DRIVERS_LICENSE':
        return '운전면허증';
      case 'NATIONAL_ID':
        return '주민등록증';
      default:
        return documentType;
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatAddress(address: { street: string; city: string; postalCode: string; country: string }): string {
    return `${address.street}, ${address.city} ${address.postalCode}`;
  }
}

export const adminKYCService = new AdminKYCService(); 