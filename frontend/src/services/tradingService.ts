import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// API 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 요청 인터셉터 - 토큰 자동 첨부
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 인증 실패 시 로그인 페이지로 리다이렉트
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

interface CreateOrderData {
  propertyId: number;
  orderType: number; // 0: BUY, 1: SELL
  price: number;
  quantity: number;
  expiryTime: number;
}

interface OrderFilters {
  propertyId?: number;
  orderType?: string;
  status?: string;
  trader?: string;
  page?: number;
  limit?: number;
}

interface TradeFilters {
  propertyId?: number;
  buyer?: string;
  seller?: string;
  page?: number;
  limit?: number;
}

class TradingService {
  /**
   * 주문 생성
   */
  async createOrder(orderData: CreateOrderData) {
    try {
      const response = await api.post('/trading/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  }

  /**
   * 주문 목록 조회
   */
  async getOrders(filters: OrderFilters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.propertyId) params.append('propertyId', filters.propertyId.toString());
      if (filters.orderType) params.append('orderType', filters.orderType);
      if (filters.status) params.append('status', filters.status);
      if (filters.trader) params.append('trader', filters.trader);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await api.get(`/trading/orders?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Get orders error:', error);
      throw error;
    }
  }

  /**
   * 특정 주문 조회
   */
  async getOrder(orderId: number) {
    try {
      const response = await api.get(`/trading/orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Get order error:', error);
      throw error;
    }
  }

  /**
   * 주문 취소
   */
  async cancelOrder(orderId: number) {
    try {
      const response = await api.delete(`/trading/orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Cancel order error:', error);
      throw error;
    }
  }

  /**
   * 주문 매칭
   */
  async matchOrders(buyOrderId: number, sellOrderId: number, quantity: number) {
    try {
      const response = await api.post('/trading/match', {
        buyOrderId,
        sellOrderId,
        quantity
      });
      return response.data;
    } catch (error) {
      console.error('Match orders error:', error);
      throw error;
    }
  }

  /**
   * 거래 목록 조회
   */
  async getTrades(filters: TradeFilters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.propertyId) params.append('propertyId', filters.propertyId.toString());
      if (filters.buyer) params.append('buyer', filters.buyer);
      if (filters.seller) params.append('seller', filters.seller);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await api.get(`/trading/trades?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Get trades error:', error);
      throw error;
    }
  }

  /**
   * 특정 거래 조회
   */
  async getTrade(tradeId: number) {
    try {
      const response = await api.get(`/trading/trades/${tradeId}`);
      return response.data;
    } catch (error) {
      console.error('Get trade error:', error);
      throw error;
    }
  }

  /**
   * 에스크로 생성
   */
  async createEscrow(tradeId: number, amount: number, conditions: string) {
    try {
      const response = await api.post('/trading/escrow', {
        tradeId,
        amount,
        conditions
      });
      return response.data;
    } catch (error) {
      console.error('Create escrow error:', error);
      throw error;
    }
  }

  /**
   * 에스크로 해제
   */
  async releaseEscrow(escrowId: number) {
    try {
      const response = await api.post(`/trading/escrow/${escrowId}/release`);
      return response.data;
    } catch (error) {
      console.error('Release escrow error:', error);
      throw error;
    }
  }

  /**
   * 에스크로 환불
   */
  async refundEscrow(escrowId: number) {
    try {
      const response = await api.post(`/trading/escrow/${escrowId}/refund`);
      return response.data;
    } catch (error) {
      console.error('Refund escrow error:', error);
      throw error;
    }
  }

  /**
   * 거래 히스토리 조회
   */
  async getTradingHistory(filters: OrderFilters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.propertyId) params.append('propertyId', filters.propertyId.toString());
      if (filters.orderType) params.append('orderType', filters.orderType);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await api.get(`/trading/history?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Get trading history error:', error);
      throw error;
    }
  }

  /**
   * 거래 통계 조회
   */
  async getTradingStats() {
    try {
      const response = await api.get('/trading/stats');
      return response.data;
    } catch (error) {
      console.error('Get trading stats error:', error);
      throw error;
    }
  }

  /**
   * 오더북 조회
   */
  async getOrderBook(propertyId: number) {
    try {
      const response = await api.get(`/trading/orderbook/${propertyId}`);
      return response.data;
    } catch (error) {
      console.error('Get order book error:', error);
      throw error;
    }
  }

  /**
   * 실시간 오더북 구독 (WebSocket)
   */
  subscribeToOrderBook(propertyId: number, callback: (data: any) => void) {
    // WebSocket 연결 구현
    const wsUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001';
    const ws = new WebSocket(`${wsUrl}/ws/orderbook/${propertyId}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return ws;
  }

  /**
   * 실시간 거래 구독 (WebSocket)
   */
  subscribeToTrades(propertyId: number, callback: (data: any) => void) {
    const wsUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001';
    const ws = new WebSocket(`${wsUrl}/ws/trades/${propertyId}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return ws;
  }

  /**
   * 실시간 주문 업데이트 구독 (WebSocket)
   */
  subscribeToOrders(callback: (data: any) => void) {
    const wsUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001';
    const ws = new WebSocket(`${wsUrl}/ws/orders`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return ws;
  }
}

export default new TradingService(); 