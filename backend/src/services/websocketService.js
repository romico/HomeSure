const WebSocket = require('ws');
const logger = require('../utils/logger');

class WebSocketService {
  constructor(server) {
    // 기본 속성 초기화
    this.clients = new Map(); // clientId -> { ws, subscriptions }
    this.priceData = new Map(); // propertyId -> price data
    this.portfolioData = new Map(); // userId -> portfolio data
    this.transactionData = new Map(); // userId -> transaction data
    
    // 환경 변수에서 설정 가져오기
    this.maxReconnectAttempts = parseInt(process.env.WEBSOCKET_MAX_RECONNECT_ATTEMPTS) || 5;
    this.reconnectDelay = parseInt(process.env.WEBSOCKET_RECONNECT_DELAY) || 1000;
    this.heartbeatInterval = parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL) || 30000;
    this.enabled = process.env.WEBSOCKET_ENABLED !== 'false';
    
    // WebSocket 활성화 여부 확인
    if (!this.enabled) {
      logger.info('WebSocket service disabled by environment variable');
      return;
    }

    try {
      this.wss = new WebSocket.Server({ 
        server,
        // CORS 헤더 추가
        verifyClient: (info) => {
          const origin = info.origin || info.req.headers.origin;
          const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
          
          // file:// 프로토콜 (로컬 HTML 파일) 허용
          if (!origin || origin.startsWith('file://')) {
            logger.info(`WebSocket connection allowed from file:// or no origin`);
            return true;
          }
          
          if (origin !== allowedOrigin) {
            logger.warn(`WebSocket connection rejected from origin: ${origin}`);
            return false;
          }
          
          logger.info(`WebSocket connection allowed from origin: ${origin}`);
          return true;
        }
      });
      this.setupWebSocketServer();
      this.startDataSimulation();
      
      logger.info(`WebSocket service initialized with config:`, {
        enabled: this.enabled,
        maxReconnectAttempts: this.maxReconnectAttempts,
        reconnectDelay: this.reconnectDelay,
        heartbeatInterval: this.heartbeatInterval
      });
    } catch (error) {
      logger.error('Failed to initialize WebSocket server:', error);
      this.enabled = false;
    }
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      logger.info(`WebSocket client connected: ${clientId}`);

      // 클라이언트 정보 저장
      this.clients.set(clientId, {
        ws,
        subscriptions: {
          prices: new Set(),
          portfolio: null,
          transactions: null
        },
        connectedAt: new Date()
      });

      // 연결 확인 메시지
      this.sendToClient(clientId, {
        type: 'connection_established',
        data: { clientId, timestamp: Date.now() }
      });

      // 메시지 처리
      ws.on('message', (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          this.handleMessage(clientId, parsedMessage);
        } catch (error) {
          logger.error('WebSocket message parsing error:', error);
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: 'Invalid message format' }
          });
        }
      });

      // 연결 종료 처리
      ws.on('close', (code, reason) => {
        logger.info(`WebSocket client disconnected: ${clientId}, code: ${code}, reason: ${reason}`);
        this.clients.delete(clientId);
      });

      // 에러 처리
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Heartbeat 응답
      ws.on('ping', () => {
        ws.pong();
      });
    });

    logger.info('WebSocket server initialized');
  }

  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          data: { timestamp: Date.now() }
        });
        break;

      case 'subscribe_prices':
        this.subscribeToPrices(clientId, message.data.propertyIds);
        break;

      case 'subscribe_portfolio':
        this.subscribeToPortfolio(clientId, message.data.userId);
        break;

      case 'subscribe_transactions':
        this.subscribeToTransactions(clientId, message.data.userId);
        break;

      case 'unsubscribe_prices':
        this.unsubscribeFromPrices(clientId, message.data.propertyIds);
        break;

      case 'unsubscribe_portfolio':
        this.unsubscribeFromPortfolio(clientId);
        break;

      case 'unsubscribe_transactions':
        this.unsubscribeFromTransactions(clientId);
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
        this.sendToClient(clientId, {
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` }
        });
    }
  }

  subscribeToPrices(clientId, propertyIds) {
    const client = this.clients.get(clientId);
    if (!client) return;

    propertyIds.forEach(propertyId => {
      client.subscriptions.prices.add(propertyId);
    });

    logger.info(`Client ${clientId} subscribed to prices: ${propertyIds.join(', ')}`);

    // 현재 가격 데이터 전송
    propertyIds.forEach(propertyId => {
      const priceData = this.priceData.get(propertyId);
      if (priceData) {
        this.sendToClient(clientId, {
          type: 'price_update',
          data: priceData
        });
      }
    });
  }

  subscribeToPortfolio(clientId, userId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.portfolio = userId;
    logger.info(`Client ${clientId} subscribed to portfolio for user: ${userId}`);

    // 현재 포트폴리오 데이터 전송
    const portfolioData = this.portfolioData.get(userId);
    if (portfolioData) {
      this.sendToClient(clientId, {
        type: 'portfolio_update',
        data: portfolioData
      });
    }
  }

  subscribeToTransactions(clientId, userId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.transactions = userId;
    logger.info(`Client ${clientId} subscribed to transactions for user: ${userId}`);

    // 최근 거래 데이터 전송
    const transactions = this.transactionData.get(userId);
    if (transactions) {
      transactions.forEach(transaction => {
        this.sendToClient(clientId, {
          type: 'transaction_update',
          data: transaction
        });
      });
    }
  }

  unsubscribeFromPrices(clientId, propertyIds) {
    const client = this.clients.get(clientId);
    if (!client) return;

    propertyIds.forEach(propertyId => {
      client.subscriptions.prices.delete(propertyId);
    });

    logger.info(`Client ${clientId} unsubscribed from prices: ${propertyIds.join(', ')}`);
  }

  unsubscribeFromPortfolio(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.portfolio = null;
    logger.info(`Client ${clientId} unsubscribed from portfolio`);
  }

  unsubscribeFromTransactions(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.transactions = null;
    logger.info(`Client ${clientId} unsubscribed from transactions`);
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  broadcastToSubscribers(type, data, filter = null) {
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState !== WebSocket.OPEN) return;

      let shouldSend = false;

      switch (type) {
        case 'price_update':
          shouldSend = client.subscriptions.prices.has(data.propertyId);
          break;
        case 'portfolio_update':
          shouldSend = client.subscriptions.portfolio === data.userId;
          break;
        case 'transaction_update':
          shouldSend = client.subscriptions.transactions === data.userId;
          break;
        default:
          shouldSend = true;
      }

      if (shouldSend && (!filter || filter(client))) {
        this.sendToClient(clientId, { type, data });
      }
    });
  }

  // 가격 데이터 업데이트
  updatePriceData(propertyId, priceData) {
    this.priceData.set(propertyId, priceData);
    this.broadcastToSubscribers('price_update', priceData);
  }

  // 포트폴리오 데이터 업데이트
  updatePortfolioData(userId, portfolioData) {
    this.portfolioData.set(userId, portfolioData);
    this.broadcastToSubscribers('portfolio_update', { ...portfolioData, userId });
  }

  // 거래 데이터 업데이트
  updateTransactionData(userId, transactionData) {
    if (!this.transactionData.has(userId)) {
      this.transactionData.set(userId, []);
    }
    
    const transactions = this.transactionData.get(userId);
    transactions.unshift(transactionData);
    
    // 최근 50개 거래만 유지
    if (transactions.length > 50) {
      transactions.splice(50);
    }
    
    this.broadcastToSubscribers('transaction_update', transactionData);
  }

  // 알림 전송
  sendNotification(userId, notification) {
    this.broadcastToSubscribers('notification', {
      userId,
      ...notification
    }, (client) => client.subscriptions.portfolio === userId || client.subscriptions.transactions === userId);
  }

  // 데이터 시뮬레이션 (실제 구현에서는 외부 API나 데이터베이스에서 가져옴)
  startDataSimulation() {
    // 가격 데이터 시뮬레이션
    setInterval(() => {
      const propertyIds = ['property-1', 'property-2', 'property-3', 'property-4', 'property-5'];
      
      propertyIds.forEach(propertyId => {
        const currentPrice = this.priceData.get(propertyId)?.price || 100 + Math.random() * 50;
        const change = (Math.random() - 0.5) * 2; // ±1 ETH 변동
        const newPrice = currentPrice + change;
        
        this.updatePriceData(propertyId, {
          propertyId,
          price: parseFloat(newPrice.toFixed(4)),
          change: parseFloat(change.toFixed(4)),
          changePercent: parseFloat(((change / currentPrice) * 100).toFixed(2)),
          timestamp: Date.now()
        });
      });
    }, 10000); // 10초마다 업데이트

    // 포트폴리오 데이터 시뮬레이션
    setInterval(() => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      
      userIds.forEach(userId => {
        const totalValue = 100 + Math.random() * 200;
        const change = (Math.random() - 0.5) * 10;
        
        this.updatePortfolioData(userId, {
          totalValue: parseFloat(totalValue.toFixed(4)),
          change: parseFloat(change.toFixed(4)),
          changePercent: parseFloat(((change / (totalValue - change)) * 100).toFixed(2)),
          assets: [
            { id: 'asset-1', name: '부동산 A', value: totalValue * 0.3, percentage: 30 },
            { id: 'asset-2', name: '부동산 B', value: totalValue * 0.25, percentage: 25 },
            { id: 'asset-3', name: '부동산 C', value: totalValue * 0.2, percentage: 20 },
            { id: 'asset-4', name: '부동산 D', value: totalValue * 0.15, percentage: 15 },
            { id: 'asset-5', name: '부동산 E', value: totalValue * 0.1, percentage: 10 }
          ],
          timestamp: Date.now()
        });
      });
    }, 30000); // 30초마다 업데이트

    // 거래 데이터 시뮬레이션
    setInterval(() => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const transactionTypes = ['buy', 'sell', 'transfer'];
      const propertyIds = ['property-1', 'property-2', 'property-3', 'property-4', 'property-5'];
      
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      const randomType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
      const randomPropertyId = propertyIds[Math.floor(Math.random() * propertyIds.length)];
      
      this.updateTransactionData(randomUserId, {
        id: `tx-${Date.now()}`,
        type: randomType,
        amount: parseFloat((Math.random() * 10).toFixed(4)),
        propertyId: randomPropertyId,
        status: 'confirmed',
        timestamp: Date.now()
      });
    }, 60000); // 1분마다 업데이트
  }

  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    return {
      enabled: this.enabled,
      totalClients: this.clients.size,
      priceSubscriptions: Array.from(this.clients.values()).reduce((sum, client) => sum + client.subscriptions.prices.size, 0),
      portfolioSubscriptions: Array.from(this.clients.values()).filter(client => client.subscriptions.portfolio).length,
      transactionSubscriptions: Array.from(this.clients.values()).filter(client => client.subscriptions.transactions).length,
      priceDataCount: this.priceData.size,
      portfolioDataCount: this.portfolioData.size,
      transactionDataCount: this.transactionData.size,
      config: {
        maxReconnectAttempts: this.maxReconnectAttempts,
        reconnectDelay: this.reconnectDelay,
        heartbeatInterval: this.heartbeatInterval
      }
    };
  }
}

module.exports = WebSocketService; 