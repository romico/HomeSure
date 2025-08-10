const WebSocket = require('ws');
const logger = require('../utils/logger');

class WebSocketService {
  constructor(server) {
    // 기본 속성 초기화
    this.clients = new Map(); // clientId -> { ws, subscriptions }
    this.priceData = new Map(); // propertyId -> price data
    this.portfolioData = new Map(); // userId -> portfolio data
    this.transactionData = new Map(); // userId -> transaction data

    // 성능 최적화를 위한 인덱스
    this.priceSubscribers = new Map(); // propertyId -> Set of clientIds
    this.portfolioSubscribers = new Map(); // userId -> Set of clientIds
    this.transactionSubscribers = new Map(); // userId -> Set of clientIds

    // 환경 변수에서 설정 가져오기
    this.maxReconnectAttempts = parseInt(process.env.WEBSOCKET_MAX_RECONNECT_ATTEMPTS) || 5;
    this.reconnectDelay = parseInt(process.env.WEBSOCKET_RECONNECT_DELAY) || 1000;
    this.heartbeatInterval = parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL) || 30000;
    this.enabled = process.env.WEBSOCKET_ENABLED !== 'false';
    this.maxClients = parseInt(process.env.WEBSOCKET_MAX_CLIENTS) || 1000;
    this.messageQueueSize = parseInt(process.env.WEBSOCKET_MESSAGE_QUEUE_SIZE) || 100;

    // WebSocket 활성화 여부 확인
    if (!this.enabled) {
      logger.info('WebSocket service disabled by environment variable');
      return;
    }

    try {
      this.wss = new WebSocket.Server({
        server,
        // CORS 헤더 추가
        verifyClient: info => {
          const origin = info.origin || info.req.headers.origin;
          const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

          // file:// 프로토콜 (로컬 HTML 파일) 허용
          if (!origin || origin.startsWith('file://')) {
            return true;
          }

          if (origin !== allowedOrigin) {
            logger.warn(`WebSocket connection rejected from origin: ${origin}`);
            return false;
          }

          return true;
        },
      });
      this.setupWebSocketServer();
      this.startDataSimulation();
      this.startCleanupTask();

      logger.info(`WebSocket service initialized with config:`, {
        enabled: this.enabled,
        maxReconnectAttempts: this.maxReconnectAttempts,
        reconnectDelay: this.reconnectDelay,
        heartbeatInterval: this.heartbeatInterval,
        maxClients: this.maxClients,
        messageQueueSize: this.messageQueueSize,
      });
    } catch (error) {
      logger.error('Failed to initialize WebSocket server:', error);
      this.enabled = false;
    }
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      // 최대 클라이언트 수 제한
      if (this.clients.size >= this.maxClients) {
        logger.warn(`Maximum clients reached (${this.maxClients}), rejecting connection`);
        ws.close(1013, 'Maximum clients reached');
        return;
      }

      const clientId = this.generateClientId();

      // 클라이언트 정보 저장
      this.clients.set(clientId, {
        ws,
        subscriptions: {
          prices: new Set(),
          portfolio: null,
          transactions: null,
        },
        connectedAt: new Date(),
        customClientId: null, // 클라이언트가 전송한 고정 ID
        lastActivity: Date.now(),
      });

      // 연결 확인 메시지 전송 (비동기로)
      setTimeout(() => {
        this.sendToClient(clientId, {
          type: 'connection_established',
          data: {
            clientId,
            timestamp: Date.now(),
          },
        });
      }, 0);

      // 메시지 처리 (비동기로 처리)
      ws.on('message', message => {
        // 클라이언트 활동 시간 업데이트
        const client = this.clients.get(clientId);
        if (client) {
          client.lastActivity = Date.now();
        }

        // 비동기로 메시지 처리
        setTimeout(() => {
          try {
            const parsedMessage = JSON.parse(message);
            this.handleMessage(clientId, parsedMessage);
          } catch (error) {
            logger.error(`메시지 파싱 오류 (클라이언트 ${clientId}):`, error);
            this.sendToClient(clientId, {
              type: 'error',
              data: {
                message: 'Invalid message format',
              },
            });
          }
        }, 0);
      });

      // 연결 종료 처리
      ws.on('close', (code, reason) => {
        this.cleanupClient(clientId);
      });

      // 오류 처리
      ws.on('error', error => {
        logger.error(`WebSocket client error: ${clientId}`, error);
        this.cleanupClient(clientId);
      });
    });
  }

  handleMessage(clientId, message) {
    // 중요한 메시지만 로깅
    if (message.type !== 'ping' && message.type !== 'pong') {
      logger.debug(`Received message from client ${clientId}:`, message.type);
    }

    switch (message.type) {
      case 'client_identification':
        // 클라이언트가 전송한 고정 ID 저장
        const client = this.clients.get(clientId);
        if (client && message.data && message.data.clientId) {
          client.customClientId = message.data.clientId;
          logger.debug(`Client ${clientId} identified as: ${message.data.clientId}`);

          // 클라이언트 ID 확인 응답
          this.sendToClient(clientId, {
            type: 'client_identified',
            data: {
              serverClientId: clientId,
              customClientId: message.data.clientId,
              timestamp: Date.now(),
            },
          });
        }
        break;

      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          data: { timestamp: Date.now() },
        });
        break;

      case 'subscribe_prices':
        if (message.data && message.data.propertyIds) {
          this.subscribeToPrices(clientId, message.data.propertyIds);
          // 현재 가격 데이터를 비동기로 전송
          setTimeout(() => {
            message.data.propertyIds.forEach(propertyId => {
              const priceData = this.generatePriceData(propertyId);
              this.sendToClient(clientId, { type: 'price_update', data: priceData });
            });
          }, 0);
        }
        break;

      case 'subscribe_portfolio':
        if (message.data && message.data.userId) {
          this.subscribeToPortfolio(clientId, message.data.userId);
          // 현재 포트폴리오 데이터를 비동기로 전송
          setTimeout(() => {
            const portfolioData = this.generatePortfolioData(message.data.userId);
            this.sendToClient(clientId, { type: 'portfolio_update', data: portfolioData });
          }, 0);
        }
        break;

      case 'subscribe_transactions':
        if (message.data && message.data.userId) {
          this.subscribeToTransactions(clientId, message.data.userId);
          // 현재 거래 데이터를 비동기로 전송
          setTimeout(() => {
            const transactionData = this.generateTransactionData(message.data.userId);
            this.sendToClient(clientId, { type: 'transaction_update', data: transactionData });
          }, 0);
        }
        break;

      case 'unsubscribe_prices':
        if (message.data && message.data.propertyIds) {
          this.unsubscribeFromPrices(clientId, message.data.propertyIds);
        }
        break;

      case 'unsubscribe_portfolio':
        this.unsubscribeFromPortfolio(clientId);
        break;

      case 'unsubscribe_transactions':
        this.unsubscribeFromTransactions(clientId);
        break;

      default:
        logger.warn(`Unknown message type from client ${clientId}:`, message.type);
        this.sendToClient(clientId, {
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` },
        });
    }
  }

  subscribeToPrices(clientId, propertyIds) {
    const client = this.clients.get(clientId);
    if (!client) return;

    propertyIds.forEach(propertyId => {
      client.subscriptions.prices.add(propertyId);

      // 인덱스에 추가
      if (!this.priceSubscribers.has(propertyId)) {
        this.priceSubscribers.set(propertyId, new Set());
      }
      this.priceSubscribers.get(propertyId).add(clientId);
    });
  }

  subscribeToPortfolio(clientId, userId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.portfolio = userId;

    // 인덱스에 추가
    if (!this.portfolioSubscribers.has(userId)) {
      this.portfolioSubscribers.set(userId, new Set());
    }
    this.portfolioSubscribers.get(userId).add(clientId);
  }

  subscribeToTransactions(clientId, userId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.transactions = userId;

    // 인덱스에 추가
    if (!this.transactionSubscribers.has(userId)) {
      this.transactionSubscribers.set(userId, new Set());
    }
    this.transactionSubscribers.get(userId).add(clientId);
  }

  unsubscribeFromPrices(clientId, propertyIds) {
    const client = this.clients.get(clientId);
    if (!client) return;

    propertyIds.forEach(propertyId => {
      client.subscriptions.prices.delete(propertyId);

      // 인덱스에서 제거
      const subscribers = this.priceSubscribers.get(propertyId);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.priceSubscribers.delete(propertyId);
        }
      }
    });
  }

  unsubscribeFromPortfolio(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const userId = client.subscriptions.portfolio;
    if (userId) {
      client.subscriptions.portfolio = null;

      // 인덱스에서 제거
      const subscribers = this.portfolioSubscribers.get(userId);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.portfolioSubscribers.delete(userId);
        }
      }
    }
  }

  unsubscribeFromTransactions(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const userId = client.subscriptions.transactions;
    if (userId) {
      client.subscriptions.transactions = null;

      // 인덱스에서 제거
      const subscribers = this.transactionSubscribers.get(userId);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.transactionSubscribers.delete(userId);
        }
      }
    }
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}:`, error);
      this.cleanupClient(clientId);
    }
  }

  // 성능 최적화된 브로드캐스트
  broadcastToSubscribers(type, data) {
    let subscribers = null;

    switch (type) {
      case 'price_update':
        subscribers = this.priceSubscribers.get(data.propertyId);
        break;
      case 'portfolio_update':
        subscribers = this.portfolioSubscribers.get(data.userId);
        break;
      case 'transaction_update':
        subscribers = this.transactionSubscribers.get(data.userId);
        break;
      default:
        // 모든 클라이언트에게 전송
        this.clients.forEach((client, clientId) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            this.sendToClient(clientId, { type, data });
          }
        });
        return;
    }

    // 구독자들에게만 전송
    if (subscribers) {
      subscribers.forEach(clientId => {
        this.sendToClient(clientId, { type, data });
      });
    }
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

  // 알림 전송 (성능 최적화)
  sendNotification(userId, notification) {
    const portfolioSubscribers = this.portfolioSubscribers.get(userId);
    const transactionSubscribers = this.transactionSubscribers.get(userId);

    const allSubscribers = new Set();
    if (portfolioSubscribers) {
      portfolioSubscribers.forEach(clientId => allSubscribers.add(clientId));
    }
    if (transactionSubscribers) {
      transactionSubscribers.forEach(clientId => allSubscribers.add(clientId));
    }

    allSubscribers.forEach(clientId => {
      this.sendToClient(clientId, {
        type: 'notification',
        data: { userId, ...notification },
      });
    });
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
          timestamp: Date.now(),
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
            { id: 'asset-5', name: '부동산 E', value: totalValue * 0.1, percentage: 10 },
          ],
          timestamp: Date.now(),
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
        timestamp: Date.now(),
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
      priceSubscriptions: Array.from(this.priceSubscribers.values()).reduce(
        (sum, subscribers) => sum + subscribers.size,
        0
      ),
      portfolioSubscriptions: Array.from(this.portfolioSubscribers.values()).reduce(
        (sum, subscribers) => sum + subscribers.size,
        0
      ),
      transactionSubscriptions: Array.from(this.transactionSubscribers.values()).reduce(
        (sum, subscribers) => sum + subscribers.size,
        0
      ),
      priceDataCount: this.priceData.size,
      portfolioDataCount: this.portfolioData.size,
      transactionDataCount: this.transactionData.size,
      config: {
        maxReconnectAttempts: this.maxReconnectAttempts,
        reconnectDelay: this.reconnectDelay,
        heartbeatInterval: this.heartbeatInterval,
        maxClients: this.maxClients,
        messageQueueSize: this.messageQueueSize,
      },
    };
  }

  // 클라이언트 정리 메서드
  cleanupClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // 구독 정보 정리
    this.removeClientFromAllSubscriptions(clientId, client.subscriptions);

    // 클라이언트 제거
    this.clients.delete(clientId);
  }

  // 모든 구독에서 클라이언트 제거
  removeClientFromAllSubscriptions(clientId, subscriptions) {
    // 가격 구독에서 제거
    subscriptions.prices.forEach(propertyId => {
      const subscribers = this.priceSubscribers.get(propertyId);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.priceSubscribers.delete(propertyId);
        }
      }
    });

    // 포트폴리오 구독에서 제거
    if (subscriptions.portfolio) {
      const subscribers = this.portfolioSubscribers.get(subscriptions.portfolio);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.portfolioSubscribers.delete(subscriptions.portfolio);
        }
      }
    }

    // 거래 구독에서 제거
    if (subscriptions.transactions) {
      const subscribers = this.transactionSubscribers.get(subscriptions.transactions);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.transactionSubscribers.delete(subscriptions.transactions);
        }
      }
    }
  }

  // 정기 클린업 작업
  startCleanupTask() {
    setInterval(() => {
      const now = Date.now();
      const inactiveThreshold = 5 * 60 * 1000; // 5분

      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastActivity > inactiveThreshold) {
          logger.info(`Cleaning up inactive client: ${clientId}`);
          this.cleanupClient(clientId);
        }
      }
    }, 60000); // 1분마다 실행
  }
}

module.exports = WebSocketService;
