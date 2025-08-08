import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// 사용자 상태 타입 정의
export interface UserState {
  id: string | null;
  walletAddress: string | null;
  balance: string | null;
  isAuthenticated: boolean;
  profile: {
    name: string | null;
    email: string | null;
    kycStatus: 'pending' | 'approved' | 'rejected' | null;
    whitelistStatus: boolean;
  };
  preferences: {
    theme: 'light' | 'dark';
    language: 'ko' | 'en';
    notifications: boolean;
  };
}

// 액션 타입 정의
type UserAction =
  | { type: 'SET_USER_ID'; payload: string | null }
  | { type: 'SET_WALLET_ADDRESS'; payload: string | null }
  | { type: 'SET_BALANCE'; payload: string | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_PROFILE'; payload: Partial<UserState['profile']> }
  | { type: 'SET_PREFERENCES'; payload: Partial<UserState['preferences']> }
  | { type: 'UPDATE_KYC_STATUS'; payload: UserState['profile']['kycStatus'] }
  | { type: 'UPDATE_WHITELIST_STATUS'; payload: boolean }
  | { type: 'RESET_USER' };

// 초기 상태
const initialState: UserState = {
  id: null,
  walletAddress: null,
  balance: null,
  isAuthenticated: false,
  profile: {
    name: null,
    email: null,
    kycStatus: null,
    whitelistStatus: false,
  },
  preferences: {
    theme: 'light',
    language: 'ko',
    notifications: true,
  },
};

// 리듀서 함수
function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case 'SET_USER_ID':
      return {
        ...state,
        id: action.payload,
      };

    case 'SET_WALLET_ADDRESS':
      return {
        ...state,
        walletAddress: action.payload,
        isAuthenticated: !!action.payload,
      };

    case 'SET_BALANCE':
      return {
        ...state,
        balance: action.payload,
      };

    case 'SET_AUTHENTICATED':
      return {
        ...state,
        isAuthenticated: action.payload,
      };

    case 'SET_PROFILE':
      return {
        ...state,
        profile: {
          ...state.profile,
          ...action.payload,
        },
      };

    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload,
        },
      };

    case 'UPDATE_KYC_STATUS':
      return {
        ...state,
        profile: {
          ...state.profile,
          kycStatus: action.payload,
        },
      };

    case 'UPDATE_WHITELIST_STATUS':
      return {
        ...state,
        profile: {
          ...state.profile,
          whitelistStatus: action.payload,
        },
      };

    case 'RESET_USER':
      return initialState;

    default:
      return state;
  }
}

// Context 타입 정의
interface UserContextType {
  state: UserState;
  dispatch: React.Dispatch<UserAction>;
  setWalletAddress: (address: string | null) => void;
  setBalance: (balance: string | null) => void;
  setProfile: (profile: Partial<UserState['profile']>) => void;
  setPreferences: (preferences: Partial<UserState['preferences']>) => void;
  updateKycStatus: (status: UserState['profile']['kycStatus']) => void;
  updateWhitelistStatus: (status: boolean) => void;
  resetUser: () => void;
}

// Context 생성
const UserContext = createContext<UserContextType | undefined>(undefined);

// Provider 컴포넌트
interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);

  // 로컬 스토리지에서 상태 복원
  useEffect(() => {
    const savedState = localStorage.getItem('userState');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        // 민감한 정보는 제외하고 복원
        if (parsedState.preferences) {
          dispatch({ type: 'SET_PREFERENCES', payload: parsedState.preferences });
        }
      } catch (error) {
        console.error('Failed to parse saved user state:', error);
      }
    }
  }, []);

  // 상태 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    const stateToSave = {
      preferences: state.preferences,
    };
    localStorage.setItem('userState', JSON.stringify(stateToSave));
  }, [state.preferences]);

  // 액션 함수들
  const setWalletAddress = (address: string | null) => {
    dispatch({ type: 'SET_WALLET_ADDRESS', payload: address });
  };

  const setBalance = (balance: string | null) => {
    dispatch({ type: 'SET_BALANCE', payload: balance });
  };

  const setProfile = (profile: Partial<UserState['profile']>) => {
    dispatch({ type: 'SET_PROFILE', payload: profile });
  };

  const setPreferences = (preferences: Partial<UserState['preferences']>) => {
    dispatch({ type: 'SET_PREFERENCES', payload: preferences });
  };

  const updateKycStatus = (status: UserState['profile']['kycStatus']) => {
    dispatch({ type: 'UPDATE_KYC_STATUS', payload: status });
  };

  const updateWhitelistStatus = (status: boolean) => {
    dispatch({ type: 'UPDATE_WHITELIST_STATUS', payload: status });
  };

  const resetUser = () => {
    dispatch({ type: 'RESET_USER' });
  };

  const value: UserContextType = {
    state,
    dispatch,
    setWalletAddress,
    setBalance,
    setProfile,
    setPreferences,
    updateKycStatus,
    updateWhitelistStatus,
    resetUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// Hook
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}; 