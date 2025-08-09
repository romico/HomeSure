import api from './api';

export interface PropertyData {
  id: string;
  location: string;
  totalValue: string;
  landArea: number;
  buildingArea: number;
  yearBuilt: number;
  propertyType: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'LAND' | 'MIXED';
  status: 'PENDING' | 'ACTIVE' | 'SOLD' | 'SUSPENDED';
  isTokenized: boolean;
  metadata: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyRegistrationRequest {
  location: string;
  totalValue: string;
  landArea: number;
  buildingArea: number;
  yearBuilt: number;
  propertyType: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'LAND' | 'MIXED';
  metadata: string;
  title?: string;
  description?: string;
  city?: string;
  country?: string;
  postalCode?: string;
}

export interface TokenizationData {
  propertyId: string;
  totalTokens: string;
  tokenPrice: string;
  minInvestment: string;
  maxInvestment: string;
  lockupPeriod: number;
  dividendRate: number;
  tokenMetadata: string;
}

export interface PropertyToken {
  propertyId: string;
  tokenSymbol: string;
  totalSupply: string;
  currentPrice: string;
  marketCap: string;
  volume24h: string;
  change24h: string;
  dividendYield: string;
  lockupPeriod: number;
  minInvestment: string;
  maxInvestment: string;
}

class PropertyService {
  private baseUrl = '/properties';

  // 부동산 목록 조회
  async getProperties(params?: {
    page?: number;
    limit?: number;
    status?: string;
    propertyType?: string;
    minValue?: string;
    maxValue?: string;
  }): Promise<{
    properties: PropertyData[];
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
    if (params?.propertyType) queryParams.append('propertyType', params.propertyType);
    if (params?.minValue) queryParams.append('minValue', params.minValue);
    if (params?.maxValue) queryParams.append('maxValue', params.maxValue);

    const response = await api.get(`${this.baseUrl}?${queryParams.toString()}`);
    return response.data;
  }

  // 특정 부동산 정보 조회
  async getProperty(propertyId: string): Promise<PropertyData> {
    const response = await api.get(`${this.baseUrl}/${propertyId}`);
    return response.data;
  }

  // 부동산 등록 (DB 저장)
  async createRegistrationRequest(request: PropertyRegistrationRequest): Promise<{
    property: PropertyData;
  }> {
    const payload = {
      title: request.title || `Property at ${request.location}`,
      description: request.description || request.metadata || '',
      location: request.location,
      city: request.city || 'N/A',
      country: request.country || 'N/A',
      postalCode: request.postalCode || '00000',
      propertyType: request.propertyType,
      totalValue: request.totalValue,
      landArea: request.landArea,
      buildingArea: request.buildingArea,
      yearBuilt: request.yearBuilt,
      metadata: request.metadata ? { note: request.metadata } : {},
    } as any;

    const response = await api.post(`/properties`, payload);
    return response.data;
  }

  // 등록 요청 상태 확인
  async getRegistrationStatus(requestId: string): Promise<{
    requestId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    propertyId?: string;
    rejectionReason?: string;
    createdAt: string;
    processedAt?: string;
  }> {
    const response = await api.get(`${this.baseUrl}/register/${requestId}/status`);
    return response.data;
  }

  // 부동산 토큰화
  async tokenizeProperty(tokenizationData: TokenizationData): Promise<{
    propertyId: string;
    tokenContractAddress: string;
    tokenSymbol: string;
    totalTokens: string;
    tokenPrice: string;
    transactionHash: string;
  }> {
    const response = await api.post(
      `${this.baseUrl}/${tokenizationData.propertyId}/tokenize`,
      tokenizationData
    );
    return response.data;
  }

  // 토큰화된 부동산 목록 조회
  async getTokenizedProperties(): Promise<PropertyToken[]> {
    const response = await api.get(`${this.baseUrl}/tokenized`);
    return response.data;
  }

  // 부동산 토큰 정보 조회
  async getPropertyToken(propertyId: string): Promise<PropertyToken> {
    const response = await api.get(`${this.baseUrl}/${propertyId}/token`);
    return response.data;
  }

  // 부동산 검색
  async searchProperties(query: string): Promise<PropertyData[]> {
    const response = await api.get(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  // 부동산 통계
  async getPropertyStats(): Promise<{
    totalProperties: number;
    tokenizedProperties: number;
    totalValue: string;
    averageValue: string;
    propertiesByType: Record<string, number>;
    propertiesByStatus: Record<string, number>;
  }> {
    const response = await api.get(`${this.baseUrl}/stats`);
    return response.data;
  }

  // 헬퍼 메서드들
  getPropertyTypeLabel(propertyType: string): string {
    switch (propertyType.toUpperCase()) {
      case 'RESIDENTIAL':
        return '주거용';
      case 'COMMERCIAL':
        return '상업용';
      case 'INDUSTRIAL':
        return '산업용';
      case 'LAND':
        return '토지';
      case 'MIXED':
        return '복합용도';
      default:
        return propertyType;
    }
  }

  getStatusLabel(status: string): string {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return '대기 중';
      case 'ACTIVE':
        return '활성';
      case 'SOLD':
        return '판매 완료';
      case 'SUSPENDED':
        return '일시 중지';
      default:
        return status;
    }
  }

  getStatusColor(status: string): string {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'text-green-600';
      case 'PENDING':
        return 'text-yellow-600';
      case 'SOLD':
        return 'text-blue-600';
      case 'SUSPENDED':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }

  formatCurrency(amount: string): string {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(parseFloat(amount));
  }

  formatArea(area: number): string {
    return `${area.toLocaleString()}㎡`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
}

export const propertyService = new PropertyService();
