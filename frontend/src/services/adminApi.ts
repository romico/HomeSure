import apiService from './api';

export interface KYCUser {
  id: string;
  userId: string;
  userAddress: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'SUSPENDED' | 'VERIFIED';
  level: string;
  riskLevel: string;
  verificationDate: string;
  expiryDate: string;
  riskScore: number;
  documentType: string;
  country: string;
  isWhitelisted: boolean;
  isBlacklisted: boolean;
  whitelistStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KYCStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  suspended: number;
  whitelisted: number;
  blacklisted: number;
  todayVerifications: number;
  weeklyVerifications: number;
  approvalRate: string;
}

export interface AMLAlert {
  id: string;
  transactionId: string;
  userId: string;
  userAddress: string;
  userName: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  riskScore: number;
  amount: number;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: string;
  createdAt: string;
}

export interface AMLStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  pending: number;
  todayAlerts: number;
  weeklyAlerts: number;
  averageRiskScore: number;
  resolutionRate: string;
}

export interface WhitelistEntry {
  id: string;
  userId: string;
  userAddress: string;
  userName: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  reason?: string;
  expiresAt?: string;
  verificationStatus: string;
  createdAt: string;
}

export interface DashboardOverview {
  kyc: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    whitelisted: number;
  };
  aml: {
    totalAlerts: number;
    pendingAlerts: number;
    criticalAlerts: number;
    totalTransactions: number;
    flaggedTransactions: number;
  };
  whitelist: {
    total: number;
    active: number;
    suspended: number;
  };
  recentAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    userName: string;
    createdAt: string;
  }>;
  recentVerifications: Array<{
    id: string;
    userName: string;
    email: string;
    createdAt: string;
  }>;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class AdminApiService {
  private baseUrl = '/api/admin';

  // KYC 관련 API
  async getKYCUsers(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<PaginationResponse<KYCUser>> {
    const response = await apiService.get(`${this.baseUrl}/kyc/users`, { params });
    return response.data;
  }

  async getKYCStats(): Promise<KYCStats> {
    const response = await apiService.get(`${this.baseUrl}/kyc/stats`);
    return response.data;
  }

  async approveKYC(userId: string, reason?: string, level?: string): Promise<any> {
    const response = await apiService.post(`${this.baseUrl}/kyc/approve/${userId}`, {
      reason,
      level
    });
    return response.data;
  }

  async rejectKYC(userId: string, reason: string): Promise<any> {
    const response = await apiService.post(`${this.baseUrl}/kyc/reject/${userId}`, {
      reason
    });
    return response.data;
  }

  async suspendKYC(userId: string, reason: string): Promise<any> {
    const response = await apiService.post(`${this.baseUrl}/kyc/suspend/${userId}`, {
      reason
    });
    return response.data;
  }

  // AML 관련 API
  async getAMLAlerts(params: {
    page?: number;
    limit?: number;
    severity?: string;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<PaginationResponse<AMLAlert>> {
    const response = await apiService.get(`${this.baseUrl}/aml/alerts`, { params });
    return response.data;
  }

  async getAMLStats(): Promise<AMLStats> {
    const response = await apiService.get(`${this.baseUrl}/aml/stats`);
    return response.data;
  }

  async resolveAMLAlert(alertId: string, resolution: string): Promise<any> {
    const response = await apiService.put(`${this.baseUrl}/aml/alerts/${alertId}/resolve`, {
      resolution
    });
    return response.data;
  }

  async escalateAMLAlert(alertId: string, reason: string): Promise<any> {
    const response = await apiService.post(`${this.baseUrl}/aml/alerts/${alertId}/escalate`, {
      reason
    });
    return response.data;
  }

  // 화이트리스트 관련 API
  async getWhitelist(params: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaginationResponse<WhitelistEntry>> {
    const response = await apiService.get(`${this.baseUrl}/whitelist`, { params });
    return response.data;
  }

  // 대시보드 통합 API
  async getDashboardOverview(): Promise<DashboardOverview> {
    const response = await apiService.get(`${this.baseUrl}/dashboard/overview`);
    return response.data;
  }

  // 실시간 데이터 (WebSocket 대신 polling)
  async getRealtimeData(): Promise<any> {
    const response = await apiService.get(`${this.baseUrl}/dashboard/realtime`);
    return response.data;
  }

  // 알림 조회
  async getNotifications(): Promise<any> {
    const response = await apiService.get(`${this.baseUrl}/dashboard/notifications`);
    return response.data;
  }
}

export const adminApi = new AdminApiService(); 