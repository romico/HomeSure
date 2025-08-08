import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// 트랜잭션 타입 정의
export interface Transaction {
  id: string;
  hash: string;
  type: 'buy' | 'sell' | 'transfer' | 'register';
  status: 'pending' | 'confirmed' | 'failed';
  from: string;
  to: string;
  amount: string;
  tokenAmount?: string;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  timestamp: number;
  description: string;
  propertyId?: number;
  propertyTitle?: string;
}

// 트랜잭션 상태 타입 정의
export interface TransactionState {
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  confirmedTransactions: Transaction[];
  failedTransactions: Transaction[];
  loading: boolean;
  error: string | null;
  filters: {
    type: 'all' | 'buy' | 'sell' | 'transfer' | 'register';
    status: 'all' | 'pending' | 'confirmed' | 'failed';
    dateRange: {
      start: string;
      end: string;
    };
  };
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
  };
}

// 액션 타입 정의
type TransactionAction =
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'CLEAR_PENDING_TRANSACTIONS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FILTERS'; payload: Partial<TransactionState['filters']> }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_PAGINATION'; payload: Partial<TransactionState['pagination']> }
  | { type: 'APPLY_FILTERS' };

// 초기 상태
const initialState: TransactionState = {
  transactions: [],
  pendingTransactions: [],
  confirmedTransactions: [],
  failedTransactions: [],
  loading: false,
  error: null,
  filters: {
    type: 'all',
    status: 'all',
    dateRange: {
      start: '',
      end: '',
    },
  },
  pagination: {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
  },
};

// 트랜잭션 분류 함수
const categorizeTransactions = (transactions: Transaction[]) => {
  const pending: Transaction[] = [];
  const confirmed: Transaction[] = [];
  const failed: Transaction[] = [];

  transactions.forEach(transaction => {
    switch (transaction.status) {
      case 'pending':
        pending.push(transaction);
        break;
      case 'confirmed':
        confirmed.push(transaction);
        break;
      case 'failed':
        failed.push(transaction);
        break;
    }
  });

  return { pending, confirmed, failed };
};

// 필터링 함수
const applyFilters = (transactions: Transaction[], filters: TransactionState['filters']): Transaction[] => {
  let filtered = [...transactions];

  // 타입 필터
  if (filters.type !== 'all') {
    filtered = filtered.filter(transaction => transaction.type === filters.type);
  }

  // 상태 필터
  if (filters.status !== 'all') {
    filtered = filtered.filter(transaction => transaction.status === filters.status);
  }

  // 날짜 범위 필터
  if (filters.dateRange.start) {
    const startDate = new Date(filters.dateRange.start).getTime();
    filtered = filtered.filter(transaction => transaction.timestamp >= startDate);
  }

  if (filters.dateRange.end) {
    const endDate = new Date(filters.dateRange.end).getTime();
    filtered = filtered.filter(transaction => transaction.timestamp <= endDate);
  }

  // 최신 순으로 정렬
  filtered.sort((a, b) => b.timestamp - a.timestamp);

  return filtered;
};

// 리듀서 함수
function transactionReducer(state: TransactionState, action: TransactionAction): TransactionState {
  switch (action.type) {
    case 'ADD_TRANSACTION':
      const newTransactions = [action.payload, ...state.transactions];
      const { pending, confirmed, failed } = categorizeTransactions(newTransactions);
      const newFilteredTransactions = applyFilters(newTransactions, state.filters);
      
      return {
        ...state,
        transactions: newTransactions,
        pendingTransactions: pending,
        confirmedTransactions: confirmed,
        failedTransactions: failed,
        pagination: {
          ...state.pagination,
          totalItems: newFilteredTransactions.length,
        },
      };

    case 'UPDATE_TRANSACTION':
      const updatedTransactions = state.transactions.map(transaction =>
        transaction.id === action.payload.id ? action.payload : transaction
      );
      const { pending: updatedPending, confirmed: updatedConfirmed, failed: updatedFailed } = 
        categorizeTransactions(updatedTransactions);
      const updatedFilteredTransactions = applyFilters(updatedTransactions, state.filters);

      return {
        ...state,
        transactions: updatedTransactions,
        pendingTransactions: updatedPending,
        confirmedTransactions: updatedConfirmed,
        failedTransactions: updatedFailed,
        pagination: {
          ...state.pagination,
          totalItems: updatedFilteredTransactions.length,
        },
      };

    case 'SET_TRANSACTIONS':
      const { pending: setPending, confirmed: setConfirmed, failed: setFailed } = 
        categorizeTransactions(action.payload);
      const setFilteredTransactions = applyFilters(action.payload, state.filters);

      return {
        ...state,
        transactions: action.payload,
        pendingTransactions: setPending,
        confirmedTransactions: setConfirmed,
        failedTransactions: setFailed,
        pagination: {
          ...state.pagination,
          totalItems: setFilteredTransactions.length,
        },
        loading: false,
        error: null,
      };

    case 'CLEAR_PENDING_TRANSACTIONS':
      const clearedTransactions = state.transactions.filter(
        transaction => transaction.status !== 'pending'
      );
      const { pending: clearedPending, confirmed: clearedConfirmed, failed: clearedFailed } = 
        categorizeTransactions(clearedTransactions);
      const clearedFilteredTransactions = applyFilters(clearedTransactions, state.filters);

      return {
        ...state,
        transactions: clearedTransactions,
        pendingTransactions: clearedPending,
        confirmedTransactions: clearedConfirmed,
        failedTransactions: clearedFailed,
        pagination: {
          ...state.pagination,
          totalItems: clearedFilteredTransactions.length,
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'SET_FILTERS':
      const newFilters = { ...state.filters, ...action.payload };
      const refilteredTransactions = applyFilters(state.transactions, newFilters);
      
      return {
        ...state,
        filters: newFilters,
        pagination: {
          ...state.pagination,
          currentPage: 1, // 필터 변경 시 첫 페이지로 이동
          totalItems: refilteredTransactions.length,
        },
      };

    case 'RESET_FILTERS':
      const resetFilteredTransactions = applyFilters(state.transactions, initialState.filters);
      
      return {
        ...state,
        filters: initialState.filters,
        pagination: {
          ...state.pagination,
          currentPage: 1,
          totalItems: resetFilteredTransactions.length,
        },
      };

    case 'SET_PAGINATION':
      return {
        ...state,
        pagination: {
          ...state.pagination,
          ...action.payload,
        },
      };

    case 'APPLY_FILTERS':
      const appliedFilteredTransactions = applyFilters(state.transactions, state.filters);
      
      return {
        ...state,
        pagination: {
          ...state.pagination,
          totalItems: appliedFilteredTransactions.length,
        },
      };

    default:
      return state;
  }
}

// Context 타입 정의
interface TransactionContextType {
  state: TransactionState;
  dispatch: React.Dispatch<TransactionAction>;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  setTransactions: (transactions: Transaction[]) => void;
  clearPendingTransactions: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<TransactionState['filters']>) => void;
  resetFilters: () => void;
  getPaginatedTransactions: () => Transaction[];
  getTransactionById: (id: string) => Transaction | undefined;
  getTransactionsByProperty: (propertyId: number) => Transaction[];
}

// Context 생성
const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

// Provider 컴포넌트
interface TransactionProviderProps {
  children: ReactNode;
}

export const TransactionProvider: React.FC<TransactionProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(transactionReducer, initialState);

  // 로컬 스토리지에서 트랜잭션 데이터 복원
  useEffect(() => {
    const savedTransactions = localStorage.getItem('transactions');
    if (savedTransactions) {
      try {
        const parsedTransactions = JSON.parse(savedTransactions);
        // 최근 30일간의 트랜잭션만 복원
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentTransactions = parsedTransactions.filter(
          (tx: Transaction) => tx.timestamp > thirtyDaysAgo
        );
        dispatch({ type: 'SET_TRANSACTIONS', payload: recentTransactions });
      } catch (error) {
        console.error('Failed to parse saved transactions:', error);
      }
    }
  }, []);

  // 트랜잭션 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(state.transactions));
  }, [state.transactions]);

  // 액션 함수들
  const addTransaction = (transaction: Transaction) => {
    dispatch({ type: 'ADD_TRANSACTION', payload: transaction });
  };

  const updateTransaction = (transaction: Transaction) => {
    dispatch({ type: 'UPDATE_TRANSACTION', payload: transaction });
  };

  const setTransactions = (transactions: Transaction[]) => {
    dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
  };

  const clearPendingTransactions = () => {
    dispatch({ type: 'CLEAR_PENDING_TRANSACTIONS' });
  };

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  const setFilters = (filters: Partial<TransactionState['filters']>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  };

  const resetFilters = () => {
    dispatch({ type: 'RESET_FILTERS' });
  };

  // 페이지네이션된 트랜잭션 목록 가져오기
  const getPaginatedTransactions = (): Transaction[] => {
    const { currentPage, itemsPerPage } = state.pagination;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const filteredTransactions = applyFilters(state.transactions, state.filters);
    return filteredTransactions.slice(startIndex, endIndex);
  };

  // ID로 트랜잭션 찾기
  const getTransactionById = (id: string): Transaction | undefined => {
    return state.transactions.find(transaction => transaction.id === id);
  };

  // 부동산별 트랜잭션 가져오기
  const getTransactionsByProperty = (propertyId: number): Transaction[] => {
    return state.transactions.filter(transaction => transaction.propertyId === propertyId);
  };

  const value: TransactionContextType = {
    state,
    dispatch,
    addTransaction,
    updateTransaction,
    setTransactions,
    clearPendingTransactions,
    setLoading,
    setError,
    setFilters,
    resetFilters,
    getPaginatedTransactions,
    getTransactionById,
    getTransactionsByProperty,
  };

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
};

// Hook
export const useTransaction = (): TransactionContextType => {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error('useTransaction must be used within a TransactionProvider');
  }
  return context;
}; 