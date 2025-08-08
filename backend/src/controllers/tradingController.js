const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');
const blockchainConfig = require('../config/blockchain');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class TradingController {
  /**
   * 주문 생성
   */
  async createOrder(req, res) {
    try {
      const { propertyId, orderType, price, quantity, expiryTime } = req.body;
      const userId = req.user.id;
      const userWalletAddress = req.user.walletAddress;

      if (!userWalletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address not found. Please connect your wallet first.'
        });
      }

      // 부동산 존재 확인
      const property = await prisma.property.findUnique({
        where: { propertyId: parseInt(propertyId) }
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Property not found'
        });
      }

      // KYC 검증 확인
      const kycRecord = await prisma.kYCRecord.findFirst({
        where: { userId, status: 'APPROVED' }
      });

      if (!kycRecord) {
        return res.status(403).json({
          success: false,
          message: 'KYC verification required to create orders'
        });
      }

      // 블록체인에서 주문 생성
      const tradingContract = blockchainConfig.contracts.tradingContract;
      const orderTypeEnum = parseInt(orderType); // 0: BUY, 1: SELL
      const priceWei = ethers.parseEther(price.toString());
      const quantityWei = ethers.parseEther(quantity.toString());

      let tx;
      if (orderTypeEnum === 0) { // BUY order
        const totalAmount = priceWei * quantityWei;
        tx = await tradingContract.createOrder(
          propertyId,
          orderTypeEnum,
          priceWei,
          quantityWei,
          expiryTime,
          { value: totalAmount }
        );
      } else { // SELL order
        // 토큰 승인 확인
        const propertyToken = blockchainConfig.contracts.propertyToken;
        const allowance = await propertyToken.allowance(userWalletAddress, tradingContract.address);
        
        if (allowance < quantityWei) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient token allowance. Please approve tokens first.'
          });
        }

        tx = await tradingContract.createOrder(
          propertyId,
          orderTypeEnum,
          priceWei,
          quantityWei,
          expiryTime
        );
      }

      const receipt = await tx.wait();
      const orderCreatedEvent = receipt.events?.find(e => e.event === 'OrderCreated');
      
      if (!orderCreatedEvent) {
        throw new Error('Order creation event not found');
      }

      const orderId = orderCreatedEvent.args.orderId.toString();

      // 데이터베이스에 주문 정보 저장
      const order = await prisma.order.create({
        data: {
          orderId: parseInt(orderId),
          propertyId: parseInt(propertyId),
          userId,
          orderType: orderTypeEnum === 0 ? 'BUY' : 'SELL',
          price: price,
          quantity: quantity,
          expiryTime: new Date(expiryTime * 1000),
          status: 'OPEN',
          transactionHash: tx.hash,
          blockchainOrderId: orderId
        }
      });

      // 캐시 무효화
      await cacheService.invalidatePattern(`orders:${propertyId}:*`);
      await cacheService.invalidatePattern(`orderbook:${propertyId}`);

      logger.info(`Order created: ${orderId} by user ${userId} for property ${propertyId}`);

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          orderId: parseInt(orderId),
          propertyId: parseInt(propertyId),
          orderType: orderTypeEnum === 0 ? 'BUY' : 'SELL',
          price: price,
          quantity: quantity,
          expiryTime: new Date(expiryTime * 1000),
          status: 'OPEN',
          transactionHash: tx.hash
        }
      });

    } catch (error) {
      logger.error('Create order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create order',
        error: error.message
      });
    }
  }

  /**
   * 주문 목록 조회
   */
  async getOrders(req, res) {
    try {
      const { propertyId, orderType, status, trader, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // 캐시 키 생성
      const cacheKey = `orders:${propertyId || 'all'}:${orderType || 'all'}:${status || 'all'}:${page}:${limit}`;
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // 필터 조건 구성
      const where = {};
      if (propertyId) where.propertyId = parseInt(propertyId);
      if (orderType) where.orderType = orderType === '0' ? 'BUY' : 'SELL';
      if (status) where.status = this.getOrderStatusFromEnum(parseInt(status));
      if (trader) where.user = { walletAddress: trader };

      const orders = await prisma.order.findMany({
        where,
        include: {
          property: {
            select: {
              title: true,
              location: true,
              propertyType: true
            }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              walletAddress: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      });

      const total = await prisma.order.count({ where });

      const result = {
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };

      // 캐시 저장 (5분)
      await cacheService.set(cacheKey, JSON.stringify(result), 300);

      res.json(result);

    } catch (error) {
      logger.error('Get orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get orders',
        error: error.message
      });
    }
  }

  /**
   * 특정 주문 조회
   */
  async getOrder(req, res) {
    try {
      const { orderId } = req.params;

      // 캐시 확인
      const cacheKey = `order:${orderId}`;
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      const order = await prisma.order.findUnique({
        where: { orderId: parseInt(orderId) },
        include: {
          property: {
            select: {
              title: true,
              location: true,
              propertyType: true,
              totalValue: true
            }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              walletAddress: true
            }
          }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      const result = {
        success: true,
        data: order
      };

      // 캐시 저장 (10분)
      await cacheService.set(cacheKey, JSON.stringify(result), 600);

      res.json(result);

    } catch (error) {
      logger.error('Get order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get order',
        error: error.message
      });
    }
  }

  /**
   * 주문 취소
   */
  async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const order = await prisma.order.findUnique({
        where: { orderId: parseInt(orderId) }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      if (order.userId !== userId && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to cancel this order'
        });
      }

      if (order.status !== 'OPEN' && order.status !== 'PARTIAL') {
        return res.status(400).json({
          success: false,
          message: 'Order cannot be cancelled'
        });
      }

      // 블록체인에서 주문 취소
      const tradingContract = blockchainConfig.contracts.tradingContract;
      const tx = await tradingContract.cancelOrder(order.blockchainOrderId);
      await tx.wait();

      // 데이터베이스 업데이트
      await prisma.order.update({
        where: { orderId: parseInt(orderId) },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });

      // 캐시 무효화
      await cacheService.invalidatePattern(`order:${orderId}`);
      await cacheService.invalidatePattern(`orders:*`);
      await cacheService.invalidatePattern(`orderbook:${order.propertyId}`);

      logger.info(`Order cancelled: ${orderId} by user ${userId}`);

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: {
          orderId: parseInt(orderId),
          status: 'CANCELLED',
          transactionHash: tx.hash
        }
      });

    } catch (error) {
      logger.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order',
        error: error.message
      });
    }
  }

  /**
   * 주문 매칭 및 거래 실행
   */
  async matchOrders(req, res) {
    try {
      const { buyOrderId, sellOrderId, quantity } = req.body;

      // 권한 확인 (매처 또는 관리자만)
      if (req.user.role !== 'ADMIN' && req.user.role !== 'MATCHER') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to match orders'
        });
      }

      // 블록체인에서 주문 매칭
      const tradingContract = blockchainConfig.contracts.tradingContract;
      const quantityWei = ethers.parseEther(quantity.toString());
      
      const tx = await tradingContract.matchOrders(
        buyOrderId,
        sellOrderId,
        quantityWei
      );

      const receipt = await tx.wait();
      const orderMatchedEvent = receipt.events?.find(e => e.event === 'OrderMatched');
      
      if (!orderMatchedEvent) {
        throw new Error('Order matching event not found');
      }

      const tradeId = orderMatchedEvent.args.tradeId.toString();
      const { buyer, seller, propertyId, price, quantity: matchedQuantity } = orderMatchedEvent.args;

      // 데이터베이스에 거래 정보 저장
      const trade = await prisma.trade.create({
        data: {
          tradeId: parseInt(tradeId),
          buyOrderId: parseInt(buyOrderId),
          sellOrderId: parseInt(sellOrderId),
          propertyId: parseInt(propertyId),
          buyerAddress: buyer,
          sellerAddress: seller,
          price: ethers.formatEther(price),
          quantity: ethers.formatEther(matchedQuantity),
          totalAmount: ethers.formatEther(price * matchedQuantity),
          status: 'EXECUTED',
          transactionHash: tx.hash,
          blockchainTradeId: tradeId
        }
      });

      // 주문 상태 업데이트
      await prisma.order.updateMany({
        where: {
          blockchainOrderId: {
            in: [buyOrderId.toString(), sellOrderId.toString()]
          }
        },
        data: {
          updatedAt: new Date()
        }
      });

      // 캐시 무효화
      await cacheService.invalidatePattern(`trades:*`);
      await cacheService.invalidatePattern(`orderbook:${propertyId}`);
      await cacheService.invalidatePattern(`orders:*`);

      logger.info(`Trade executed: ${tradeId} between orders ${buyOrderId} and ${sellOrderId}`);

      res.status(201).json({
        success: true,
        message: 'Trade executed successfully',
        data: {
          tradeId: parseInt(tradeId),
          buyOrderId: parseInt(buyOrderId),
          sellOrderId: parseInt(sellOrderId),
          propertyId: parseInt(propertyId),
          buyer,
          seller,
          price: ethers.formatEther(price),
          quantity: ethers.formatEther(matchedQuantity),
          transactionHash: tx.hash
        }
      });

    } catch (error) {
      logger.error('Match orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to match orders',
        error: error.message
      });
    }
  }

  /**
   * 거래 목록 조회
   */
  async getTrades(req, res) {
    try {
      const { propertyId, buyer, seller, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // 캐시 키 생성
      const cacheKey = `trades:${propertyId || 'all'}:${buyer || 'all'}:${seller || 'all'}:${page}:${limit}`;
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // 필터 조건 구성
      const where = {};
      if (propertyId) where.propertyId = parseInt(propertyId);
      if (buyer) where.buyerAddress = buyer;
      if (seller) where.sellerAddress = seller;

      const trades = await prisma.trade.findMany({
        where,
        include: {
          property: {
            select: {
              title: true,
              location: true,
              propertyType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      });

      const total = await prisma.trade.count({ where });

      const result = {
        success: true,
        data: {
          trades,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };

      // 캐시 저장 (5분)
      await cacheService.set(cacheKey, JSON.stringify(result), 300);

      res.json(result);

    } catch (error) {
      logger.error('Get trades error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trades',
        error: error.message
      });
    }
  }

  /**
   * 특정 거래 조회
   */
  async getTrade(req, res) {
    try {
      const { tradeId } = req.params;

      // 캐시 확인
      const cacheKey = `trade:${tradeId}`;
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      const trade = await prisma.trade.findUnique({
        where: { tradeId: parseInt(tradeId) },
        include: {
          property: {
            select: {
              title: true,
              location: true,
              propertyType: true,
              totalValue: true
            }
          }
        }
      });

      if (!trade) {
        return res.status(404).json({
          success: false,
          message: 'Trade not found'
        });
      }

      const result = {
        success: true,
        data: trade
      };

      // 캐시 저장 (10분)
      await cacheService.set(cacheKey, JSON.stringify(result), 600);

      res.json(result);

    } catch (error) {
      logger.error('Get trade error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trade',
        error: error.message
      });
    }
  }

  /**
   * 에스크로 생성
   */
  async createEscrow(req, res) {
    try {
      const { tradeId, amount, conditions } = req.body;

      // 권한 확인 (에스크로 매니저 또는 관리자만)
      if (req.user.role !== 'ADMIN' && req.user.role !== 'ESCROW_MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create escrow'
        });
      }

      // 블록체인에서 에스크로 생성
      const tradingContract = blockchainConfig.contracts.tradingContract;
      const amountWei = ethers.parseEther(amount.toString());
      
      const tx = await tradingContract.createEscrow(
        tradeId,
        amountWei,
        conditions
      );

      const receipt = await tx.wait();
      const escrowCreatedEvent = receipt.events?.find(e => e.event === 'EscrowCreated');
      
      if (!escrowCreatedEvent) {
        throw new Error('Escrow creation event not found');
      }

      const escrowId = escrowCreatedEvent.args.escrowId.toString();

      // 데이터베이스에 에스크로 정보 저장
      const escrow = await prisma.escrow.create({
        data: {
          escrowId: parseInt(escrowId),
          tradeId: parseInt(tradeId),
          amount: amount,
          conditions,
          status: 'PENDING',
          transactionHash: tx.hash,
          blockchainEscrowId: escrowId,
          createdBy: req.user.id
        }
      });

      logger.info(`Escrow created: ${escrowId} for trade ${tradeId}`);

      res.status(201).json({
        success: true,
        message: 'Escrow created successfully',
        data: {
          escrowId: parseInt(escrowId),
          tradeId: parseInt(tradeId),
          amount: amount,
          conditions,
          status: 'PENDING',
          transactionHash: tx.hash
        }
      });

    } catch (error) {
      logger.error('Create escrow error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create escrow',
        error: error.message
      });
    }
  }

  /**
   * 에스크로 해제
   */
  async releaseEscrow(req, res) {
    try {
      const { escrowId } = req.params;

      // 권한 확인
      if (req.user.role !== 'ADMIN' && req.user.role !== 'ESCROW_MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to release escrow'
        });
      }

      const escrow = await prisma.escrow.findUnique({
        where: { escrowId: parseInt(escrowId) }
      });

      if (!escrow) {
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      if (escrow.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          message: 'Escrow cannot be released'
        });
      }

      // 블록체인에서 에스크로 해제
      const tradingContract = blockchainConfig.contracts.tradingContract;
      const tx = await tradingContract.releaseEscrow(escrow.blockchainEscrowId);
      await tx.wait();

      // 데이터베이스 업데이트
      await prisma.escrow.update({
        where: { escrowId: parseInt(escrowId) },
        data: {
          status: 'RELEASED',
          updatedAt: new Date()
        }
      });

      logger.info(`Escrow released: ${escrowId} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Escrow released successfully',
        data: {
          escrowId: parseInt(escrowId),
          status: 'RELEASED',
          transactionHash: tx.hash
        }
      });

    } catch (error) {
      logger.error('Release escrow error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to release escrow',
        error: error.message
      });
    }
  }

  /**
   * 에스크로 환불
   */
  async refundEscrow(req, res) {
    try {
      const { escrowId } = req.params;

      // 권한 확인
      if (req.user.role !== 'ADMIN' && req.user.role !== 'ESCROW_MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to refund escrow'
        });
      }

      const escrow = await prisma.escrow.findUnique({
        where: { escrowId: parseInt(escrowId) }
      });

      if (!escrow) {
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      if (escrow.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          message: 'Escrow cannot be refunded'
        });
      }

      // 블록체인에서 에스크로 환불
      const tradingContract = blockchainConfig.contracts.tradingContract;
      const tx = await tradingContract.refundEscrow(escrow.blockchainEscrowId);
      await tx.wait();

      // 데이터베이스 업데이트
      await prisma.escrow.update({
        where: { escrowId: parseInt(escrowId) },
        data: {
          status: 'REFUNDED',
          updatedAt: new Date()
        }
      });

      logger.info(`Escrow refunded: ${escrowId} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Escrow refunded successfully',
        data: {
          escrowId: parseInt(escrowId),
          status: 'REFUNDED',
          transactionHash: tx.hash
        }
      });

    } catch (error) {
      logger.error('Refund escrow error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refund escrow',
        error: error.message
      });
    }
  }

  /**
   * 거래 히스토리 조회
   */
  async getTradingHistory(req, res) {
    try {
      const userId = req.user.id;
      const { propertyId, orderType, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // 캐시 키 생성
      const cacheKey = `trading_history:${userId}:${propertyId || 'all'}:${orderType || 'all'}:${page}:${limit}`;
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // 필터 조건 구성
      const where = { userId };
      if (propertyId) where.propertyId = parseInt(propertyId);
      if (orderType) where.orderType = orderType === '0' ? 'BUY' : 'SELL';

      const orders = await prisma.order.findMany({
        where,
        include: {
          property: {
            select: {
              title: true,
              location: true,
              propertyType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      });

      const total = await prisma.order.count({ where });

      const result = {
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };

      // 캐시 저장 (5분)
      await cacheService.set(cacheKey, JSON.stringify(result), 300);

      res.json(result);

    } catch (error) {
      logger.error('Get trading history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trading history',
        error: error.message
      });
    }
  }

  /**
   * 거래 통계 조회
   */
  async getTradingStats(req, res) {
    try {
      const userId = req.user.id;

      // 캐시 확인
      const cacheKey = `trading_stats:${userId}`;
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // 통계 계산
      const totalOrders = await prisma.order.count({ where: { userId } });
      const buyOrders = await prisma.order.count({ where: { userId, orderType: 'BUY' } });
      const sellOrders = await prisma.order.count({ where: { userId, orderType: 'SELL' } });
      const openOrders = await prisma.order.count({ where: { userId, status: 'OPEN' } });
      const totalTrades = await prisma.trade.count({
        where: {
          OR: [
            { buyerAddress: req.user.walletAddress },
            { sellerAddress: req.user.walletAddress }
          ]
        }
      });

      const totalVolume = await prisma.trade.aggregate({
        where: {
          OR: [
            { buyerAddress: req.user.walletAddress },
            { sellerAddress: req.user.walletAddress }
          ]
        },
        _sum: {
          totalAmount: true
        }
      });

      const result = {
        success: true,
        data: {
          totalOrders,
          buyOrders,
          sellOrders,
          openOrders,
          totalTrades,
          totalVolume: totalVolume._sum.totalAmount || 0
        }
      };

      // 캐시 저장 (10분)
      await cacheService.set(cacheKey, JSON.stringify(result), 600);

      res.json(result);

    } catch (error) {
      logger.error('Get trading stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trading statistics',
        error: error.message
      });
    }
  }

  /**
   * 오더북 조회
   */
  async getOrderBook(req, res) {
    try {
      const { propertyId } = req.params;

      // 캐시 확인
      const cacheKey = `orderbook:${propertyId}`;
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // 매수 주문 (가격 높은 순)
      const buyOrders = await prisma.order.findMany({
        where: {
          propertyId: parseInt(propertyId),
          orderType: 'BUY',
          status: { in: ['OPEN', 'PARTIAL'] }
        },
        orderBy: { price: 'desc' },
        take: 20
      });

      // 매도 주문 (가격 낮은 순)
      const sellOrders = await prisma.order.findMany({
        where: {
          propertyId: parseInt(propertyId),
          orderType: 'SELL',
          status: { in: ['OPEN', 'PARTIAL'] }
        },
        orderBy: { price: 'asc' },
        take: 20
      });

      const result = {
        success: true,
        data: {
          propertyId: parseInt(propertyId),
          buyOrders,
          sellOrders,
          timestamp: new Date()
        }
      };

      // 캐시 저장 (30초)
      await cacheService.set(cacheKey, JSON.stringify(result), 30);

      res.json(result);

    } catch (error) {
      logger.error('Get order book error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get order book',
        error: error.message
      });
    }
  }

  /**
   * 주문 상태 열거형 변환 헬퍼 함수
   */
  getOrderStatusFromEnum(statusEnum) {
    const statusMap = {
      0: 'OPEN',
      1: 'PARTIAL',
      2: 'FILLED',
      3: 'CANCELLED',
      4: 'EXPIRED'
    };
    return statusMap[statusEnum] || 'OPEN';
  }
}

module.exports = new TradingController(); 