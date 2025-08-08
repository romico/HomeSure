import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// 부동산 데이터 타입 정의
export interface Property {
  id: number;
  title: string;
  location: string;
  value: string;
  owner: string;
  isActive: boolean;
  tokenPrice: string;
  availableTokens: string;
  totalTokens: string;
  description?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// 필터 상태 타입 정의
export interface PropertyFilters {
  location: string;
  minValue: string;
  maxValue: string;
  status: 'all' | 'active' | 'inactive';
  sortBy: 'value' | 'createdAt' | 'title';
  sortOrder: 'asc' | 'desc';
}

// 부동산 상태 타입 정의
export interface PropertyState {
  properties: Property[];
  filteredProperties: Property[];
  selectedProperty: Property | null;
  filters: PropertyFilters;
  loading: boolean;
  error: string | null;
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
  };
}

// 액션 타입 정의
type PropertyAction =
  | { type: 'SET_PROPERTIES'; payload: Property[] }
  | { type: 'ADD_PROPERTY'; payload: Property }
  | { type: 'UPDATE_PROPERTY'; payload: Property }
  | { type: 'DELETE_PROPERTY'; payload: number }
  | { type: 'SET_SELECTED_PROPERTY'; payload: Property | null }
  | { type: 'SET_FILTERS'; payload: Partial<PropertyFilters> }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PAGINATION'; payload: Partial<PropertyState['pagination']> }
  | { type: 'APPLY_FILTERS' };

// 초기 상태
const initialState: PropertyState = {
  properties: [],
  filteredProperties: [],
  selectedProperty: null,
  filters: {
    location: '',
    minValue: '',
    maxValue: '',
    status: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
  loading: false,
  error: null,
  pagination: {
    currentPage: 1,
    itemsPerPage: 12,
    totalItems: 0,
  },
};

// 필터링 함수
const applyFilters = (properties: Property[], filters: PropertyFilters): Property[] => {
  let filtered = [...properties];

  // 위치 필터
  if (filters.location) {
    filtered = filtered.filter(property =>
      property.location.toLowerCase().includes(filters.location.toLowerCase())
    );
  }

  // 가격 범위 필터
  if (filters.minValue) {
    filtered = filtered.filter(property =>
      parseFloat(property.value) >= parseFloat(filters.minValue)
    );
  }

  if (filters.maxValue) {
    filtered = filtered.filter(property =>
      parseFloat(property.value) <= parseFloat(filters.maxValue)
    );
  }

  // 상태 필터
  if (filters.status !== 'all') {
    filtered = filtered.filter(property =>
      filters.status === 'active' ? property.isActive : !property.isActive
    );
  }

  // 정렬
  filtered.sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (filters.sortBy) {
      case 'value':
        aValue = parseFloat(a.value);
        bValue = parseFloat(b.value);
        break;
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
    }

    if (filters.sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return filtered;
};

// 리듀서 함수
function propertyReducer(state: PropertyState, action: PropertyAction): PropertyState {
  switch (action.type) {
    case 'SET_PROPERTIES':
      const filteredProperties = applyFilters(action.payload, state.filters);
      return {
        ...state,
        properties: action.payload,
        filteredProperties,
        pagination: {
          ...state.pagination,
          totalItems: filteredProperties.length,
        },
        loading: false,
        error: null,
      };

    case 'ADD_PROPERTY':
      const newProperties = [...state.properties, action.payload];
      const newFilteredProperties = applyFilters(newProperties, state.filters);
      return {
        ...state,
        properties: newProperties,
        filteredProperties: newFilteredProperties,
        pagination: {
          ...state.pagination,
          totalItems: newFilteredProperties.length,
        },
      };

    case 'UPDATE_PROPERTY':
      const updatedProperties = state.properties.map(property =>
        property.id === action.payload.id ? action.payload : property
      );
      const updatedFilteredProperties = applyFilters(updatedProperties, state.filters);
      return {
        ...state,
        properties: updatedProperties,
        filteredProperties: updatedFilteredProperties,
        selectedProperty: state.selectedProperty?.id === action.payload.id
          ? action.payload
          : state.selectedProperty,
      };

    case 'DELETE_PROPERTY':
      const remainingProperties = state.properties.filter(
        property => property.id !== action.payload
      );
      const remainingFilteredProperties = applyFilters(remainingProperties, state.filters);
      return {
        ...state,
        properties: remainingProperties,
        filteredProperties: remainingFilteredProperties,
        selectedProperty: state.selectedProperty?.id === action.payload
          ? null
          : state.selectedProperty,
        pagination: {
          ...state.pagination,
          totalItems: remainingFilteredProperties.length,
        },
      };

    case 'SET_SELECTED_PROPERTY':
      return {
        ...state,
        selectedProperty: action.payload,
      };

    case 'SET_FILTERS':
      const newFilters = { ...state.filters, ...action.payload };
      const refilteredProperties = applyFilters(state.properties, newFilters);
      return {
        ...state,
        filters: newFilters,
        filteredProperties: refilteredProperties,
        pagination: {
          ...state.pagination,
          currentPage: 1, // 필터 변경 시 첫 페이지로 이동
          totalItems: refilteredProperties.length,
        },
      };

    case 'RESET_FILTERS':
      const resetFilteredProperties = applyFilters(state.properties, initialState.filters);
      return {
        ...state,
        filters: initialState.filters,
        filteredProperties: resetFilteredProperties,
        pagination: {
          ...state.pagination,
          currentPage: 1,
          totalItems: resetFilteredProperties.length,
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

    case 'SET_PAGINATION':
      return {
        ...state,
        pagination: {
          ...state.pagination,
          ...action.payload,
        },
      };

    case 'APPLY_FILTERS':
      const appliedFilteredProperties = applyFilters(state.properties, state.filters);
      return {
        ...state,
        filteredProperties: appliedFilteredProperties,
        pagination: {
          ...state.pagination,
          totalItems: appliedFilteredProperties.length,
        },
      };

    default:
      return state;
  }
}

// Context 타입 정의
interface PropertyContextType {
  state: PropertyState;
  dispatch: React.Dispatch<PropertyAction>;
  setProperties: (properties: Property[]) => void;
  addProperty: (property: Property) => void;
  updateProperty: (property: Property) => void;
  deleteProperty: (id: number) => void;
  setSelectedProperty: (property: Property | null) => void;
  setFilters: (filters: Partial<PropertyFilters>) => void;
  resetFilters: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getPaginatedProperties: () => Property[];
}

// Context 생성
const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

// Provider 컴포넌트
interface PropertyProviderProps {
  children: ReactNode;
}

export const PropertyProvider: React.FC<PropertyProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(propertyReducer, initialState);

  // 로컬 스토리지에서 필터 상태 복원
  useEffect(() => {
    const savedFilters = localStorage.getItem('propertyFilters');
    if (savedFilters) {
      try {
        const parsedFilters = JSON.parse(savedFilters);
        dispatch({ type: 'SET_FILTERS', payload: parsedFilters });
      } catch (error) {
        console.error('Failed to parse saved property filters:', error);
      }
    }
  }, []);

  // 필터 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem('propertyFilters', JSON.stringify(state.filters));
  }, [state.filters]);

  // 액션 함수들
  const setProperties = (properties: Property[]) => {
    dispatch({ type: 'SET_PROPERTIES', payload: properties });
  };

  const addProperty = (property: Property) => {
    dispatch({ type: 'ADD_PROPERTY', payload: property });
  };

  const updateProperty = (property: Property) => {
    dispatch({ type: 'UPDATE_PROPERTY', payload: property });
  };

  const deleteProperty = (id: number) => {
    dispatch({ type: 'DELETE_PROPERTY', payload: id });
  };

  const setSelectedProperty = (property: Property | null) => {
    dispatch({ type: 'SET_SELECTED_PROPERTY', payload: property });
  };

  const setFilters = (filters: Partial<PropertyFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  };

  const resetFilters = () => {
    dispatch({ type: 'RESET_FILTERS' });
  };

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  // 페이지네이션된 부동산 목록 가져오기
  const getPaginatedProperties = (): Property[] => {
    const { currentPage, itemsPerPage } = state.pagination;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return state.filteredProperties.slice(startIndex, endIndex);
  };

  const value: PropertyContextType = {
    state,
    dispatch,
    setProperties,
    addProperty,
    updateProperty,
    deleteProperty,
    setSelectedProperty,
    setFilters,
    resetFilters,
    setLoading,
    setError,
    getPaginatedProperties,
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
};

// Hook
export const useProperty = (): PropertyContextType => {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
}; 