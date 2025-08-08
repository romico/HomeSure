// User Types
export interface User {
  id: string;
  email: string;
  walletAddress: string;
  role: UserRole;
  kycStatus: KYCStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  REGISTRAR = 'REGISTRAR',
  VALUATOR = 'VALUATOR',
  ORACLE = 'ORACLE',
  EXPERT = 'EXPERT',
  USER = 'USER'
}

export enum KYCStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

// Property Types
export interface Property {
  id: string;
  title: string;
  description: string;
  location: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  value: number;
  tokenPrice: number;
  totalTokens: number;
  availableTokens: number;
  ownerId: string;
  owner: User;
  documents: Document[];
  valuations: Valuation[];
  transactions: Transaction[];
  createdAt: string;
  updatedAt: string;
}

export enum PropertyType {
  APARTMENT = 'APARTMENT',
  HOUSE = 'HOUSE',
  COMMERCIAL = 'COMMERCIAL',
  LAND = 'LAND',
  OFFICE = 'OFFICE',
  RETAIL = 'RETAIL',
  INDUSTRIAL = 'INDUSTRIAL',
  MIXED_USE = 'MIXED_USE'
}

export enum PropertyStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  TOKENIZED = 'TOKENIZED',
  SOLD = 'SOLD',
  INACTIVE = 'INACTIVE'
}

// Document Types
export interface Document {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  documentType: DocumentType;
  fileUrl: string;
  fileHash: string;
  isVerified: boolean;
  uploadedBy: string;
  uploadedAt: string;
}

export enum DocumentType {
  DEED = 'DEED',
  SURVEY = 'SURVEY',
  APPRAISAL = 'APPRAISAL',
  INSURANCE = 'INSURANCE',
  TAX_RECORD = 'TAX_RECORD',
  BUILDING_PERMIT = 'BUILDING_PERMIT',
  ZONING_CERTIFICATE = 'ZONING_CERTIFICATE',
  OTHER = 'OTHER'
}

// Transaction Types
export interface Transaction {
  id: string;
  transactionHash: string;
  propertyId: string;
  property: Property;
  fromAddress: string;
  toAddress: string;
  amount: number;
  tokenAmount: number;
  transactionType: TransactionType;
  status: TransactionStatus;
  gasUsed: number;
  gasPrice: number;
  blockNumber: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export enum TransactionType {
  TOKEN_PURCHASE = 'TOKEN_PURCHASE',
  TOKEN_SALE = 'TOKEN_SALE',
  TOKEN_TRANSFER = 'TOKEN_TRANSFER',
  PROPERTY_REGISTRATION = 'PROPERTY_REGISTRATION',
  VALUATION_UPDATE = 'VALUATION_UPDATE',
  KYC_VERIFICATION = 'KYC_VERIFICATION'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Valuation Types
export interface Valuation {
  id: string;
  propertyId: string;
  property: Property;
  originalValue: number;
  evaluatedValue: number;
  confidenceScore: number;
  method: ValuationMethod;
  status: ValuationStatus;
  reportHash: string;
  valuatorId: string;
  valuator: User;
  expertReviews: ExpertReview[];
  disputes: Dispute[];
  createdAt: string;
  updatedAt: string;
}

export enum ValuationMethod {
  COMPARABLE_SALES = 'COMPARABLE_SALES',
  INCOME_CAPITALIZATION = 'INCOME_CAPITALIZATION',
  COST_APPROACH = 'COST_APPROACH',
  DISCOUNTED_CASH_FLOW = 'DISCOUNTED_CASH_FLOW',
  AUTOMATED_VALUATION = 'AUTOMATED_VALUATION'
}

export enum ValuationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED',
  REVISED = 'REVISED'
}

// Expert Review Types
export interface ExpertReview {
  id: string;
  valuationId: string;
  valuation: Valuation;
  expertId: string;
  expert: User;
  reviewScore: number;
  comments: string;
  recommendations: string;
  isApproved: boolean;
  createdAt: string;
}

// Dispute Types
export interface Dispute {
  id: string;
  valuationId: string;
  valuation: Valuation;
  appellantId: string;
  appellant: User;
  reason: string;
  proposedValue: number;
  status: DisputeStatus;
  resolution: string;
  resolvedBy: string;
  resolvedAt: string;
  createdAt: string;
}

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

// Portfolio Types
export interface Portfolio {
  id: string;
  userId: string;
  user: User;
  totalValue: number;
  totalTokens: number;
  totalProperties: number;
  averageReturn: number;
  properties: PortfolioProperty[];
  transactions: Transaction[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioProperty {
  propertyId: string;
  property: Property;
  tokenAmount: number;
  tokenValue: number;
  purchasePrice: number;
  currentValue: number;
  returnRate: number;
  purchaseDate: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Web3 Types
export interface Web3State {
  isConnected: boolean;
  account: string | null;
  chainId: number | null;
  networkName: string | null;
  balance: string | null;
  provider: any | null;
  signer: any | null;
}

export interface ContractState {
  propertyToken: any | null;
  propertyRegistry: any | null;
  propertyOracle: any | null;
  propertyValuation: any | null;
}

// UI Types
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
}

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'file';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    message?: string;
  };
}

// Chart Types
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

// Filter Types
export interface PropertyFilter {
  search?: string;
  propertyType?: PropertyType[];
  status?: PropertyStatus[];
  minValue?: number;
  maxValue?: number;
  location?: string;
  sortBy?: 'value' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilter {
  propertyId?: string;
  transactionType?: TransactionType[];
  status?: TransactionStatus[];
  fromDate?: string;
  toDate?: string;
  sortBy?: 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
} 