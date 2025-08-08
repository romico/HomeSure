const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const blockchainConfig = require('../config/blockchain');

const prisma = new PrismaClient();

class BlockchainService {
  /**
   * 토큰 잔액 조회
   */
  static async getTokenBalance(address) {
    try {
      if (!blockchainConfig.contracts.propertyToken) {
        throw new Error('PropertyToken contract not initialized');
      }

      const balance = await blockchainConfig.contracts.propertyToken.balanceOf(address);
      const decimals = await blockchainConfig.contracts.propertyToken.decimals();
      
      return {
        balance: balance.toString(),
        formattedBalance: ethers.formatUnits(balance, decimals),
        address: address
      };
    } catch (error) {
      logger.error('Failed to get token balance:', error);
      throw error;
    }
  }

  /**
   * 토큰 전송
   */
  static async transferTokens(from, to, amount, metadata = '') {
    try {
      if (!blockchainConfig.contracts.propertyToken) {
        throw new Error('PropertyToken contract not initialized');
      }

      const decimals = await blockchainConfig.contracts.propertyToken.decimals();
      const tokenAmount = ethers.parseUnits(amount.toString(), decimals);

      // 트랜잭션 전송
      const result = await blockchainConfig.sendTransaction(
        blockchainConfig.contracts.propertyToken,
        'transfer',
        [to, tokenAmount]
      );

      // 데이터베이스에 거래 기록
      await prisma.transaction.create({
        data: {
          transactionHash: result.hash,
          propertyId: '', // 토큰 전송은 특정 부동산과 연결되지 않음
          fromAddress: from,
          toAddress: to,
          amount: parseFloat(amount),
          tokenAmount: parseFloat(amount),
          transactionType: 'TOKEN_TRANSFER',
          status: result.status === 'success' ? 'CONFIRMED' : 'FAILED',
          gasUsed: parseInt(result.gasUsed),
          gasPrice: parseFloat(ethers.formatUnits(result.effectiveGasPrice, 'wei')),
          blockNumber: result.blockNumber,
          metadata: {
            method: 'transfer',
            gasLimit: result.gasLimit,
            originalMetadata: metadata
          },
          userId: from // 임시로 from 주소를 userId로 사용
        }
      });

      return {
        success: result.status === 'success',
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      logger.error('Failed to transfer tokens:', error);
      throw error;
    }
  }

  /**
   * 토큰 발행
   */
  static async issueTokens(to, amount, metadata = '') {
    try {
      if (!blockchainConfig.contracts.propertyToken) {
        throw new Error('PropertyToken contract not initialized');
      }

      const decimals = await blockchainConfig.contracts.propertyToken.decimals();
      const tokenAmount = ethers.parseUnits(amount.toString(), decimals);

      // 트랜잭션 전송
      const result = await blockchainConfig.sendTransaction(
        blockchainConfig.contracts.propertyToken,
        'issueTokens',
        [to, tokenAmount, metadata]
      );

      return {
        success: result.status === 'success',
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        amount: amount
      };
    } catch (error) {
      logger.error('Failed to issue tokens:', error);
      throw error;
    }
  }

  /**
   * 토큰 소각
   */
  static async burnTokens(from, amount, reason = '') {
    try {
      if (!blockchainConfig.contracts.propertyToken) {
        throw new Error('PropertyToken contract not initialized');
      }

      const decimals = await blockchainConfig.contracts.propertyToken.decimals();
      const tokenAmount = ethers.parseUnits(amount.toString(), decimals);

      // 트랜잭션 전송
      const result = await blockchainConfig.sendTransaction(
        blockchainConfig.contracts.propertyToken,
        'burnTokens',
        [from, tokenAmount]
      );

      return {
        success: result.status === 'success',
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        amount: amount
      };
    } catch (error) {
      logger.error('Failed to burn tokens:', error);
      throw error;
    }
  }

  /**
   * 부동산 등록
   */
  static async registerProperty(title, location, value, metadata = {}) {
    try {
      if (!blockchainConfig.contracts.propertyRegistry) {
        throw new Error('PropertyRegistry contract not initialized');
      }

      const valueInWei = ethers.parseEther(value.toString());
      const metadataString = JSON.stringify(metadata);

      // 트랜잭션 전송
      const result = await blockchainConfig.sendTransaction(
        blockchainConfig.contracts.propertyRegistry,
        'registerProperty',
        [title, location, valueInWei, metadataString]
      );

      // 이벤트에서 propertyId 추출 (실제로는 이벤트 로그를 파싱해야 함)
      const propertyId = await this.getPropertyCount();

      return {
        success: result.status === 'success',
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        propertyId: propertyId
      };
    } catch (error) {
      logger.error('Failed to register property:', error);
      throw error;
    }
  }

  /**
   * 부동산 정보 조회
   */
  static async getProperty(propertyId) {
    try {
      if (!blockchainConfig.contracts.propertyRegistry) {
        throw new Error('PropertyRegistry contract not initialized');
      }

      const property = await blockchainConfig.contracts.propertyRegistry.getProperty(propertyId);
      
      return {
        propertyId: propertyId,
        title: property[0],
        location: property[1],
        value: ethers.formatEther(property[2]),
        owner: property[3],
        isActive: property[4]
      };
    } catch (error) {
      logger.error('Failed to get property:', error);
      throw error;
    }
  }

  /**
   * 부동산 개수 조회
   */
  static async getPropertyCount() {
    try {
      if (!blockchainConfig.contracts.propertyRegistry) {
        throw new Error('PropertyRegistry contract not initialized');
      }

      const count = await blockchainConfig.contracts.propertyRegistry.getPropertyCount();
      return count.toString();
    } catch (error) {
      logger.error('Failed to get property count:', error);
      throw error;
    }
  }

  /**
   * 오라클 데이터 업데이트
   */
  static async updateOracleData(propertyId, dataType, value, confidence) {
    try {
      if (!blockchainConfig.contracts.propertyOracle) {
        throw new Error('PropertyOracle contract not initialized');
      }

      const valueInWei = ethers.parseEther(value.toString());

      // 트랜잭션 전송
      const result = await blockchainConfig.sendTransaction(
        blockchainConfig.contracts.propertyOracle,
        'updateData',
        [propertyId, dataType, valueInWei, confidence]
      );

      return {
        success: result.status === 'success',
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      logger.error('Failed to update oracle data:', error);
      throw error;
    }
  }

  /**
   * 오라클 데이터 조회
   */
  static async getOracleData(propertyId, dataType) {
    try {
      if (!blockchainConfig.contracts.propertyOracle) {
        throw new Error('PropertyOracle contract not initialized');
      }

      const data = await blockchainConfig.contracts.propertyOracle.getData(propertyId, dataType);
      
      return {
        propertyId: propertyId,
        dataType: dataType,
        value: ethers.formatEther(data[0]),
        confidence: data[1].toString(),
        timestamp: new Date(parseInt(data[2]) * 1000)
      };
    } catch (error) {
      logger.error('Failed to get oracle data:', error);
      throw error;
    }
  }

  /**
   * 평가 생성
   */
  static async createValuation(propertyId, originalValue, method, reportHash) {
    try {
      if (!blockchainConfig.contracts.propertyValuation) {
        throw new Error('PropertyValuation contract not initialized');
      }

      const valueInWei = ethers.parseEther(originalValue.toString());

      // 트랜잭션 전송
      const result = await blockchainConfig.sendTransaction(
        blockchainConfig.contracts.propertyValuation,
        'createValuation',
        [propertyId, valueInWei, method, reportHash]
      );

      return {
        success: result.status === 'success',
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      logger.error('Failed to create valuation:', error);
      throw error;
    }
  }

  /**
   * 평가 완료
   */
  static async completeValuation(valuationId, evaluatedValue, confidenceScore) {
    try {
      if (!blockchainConfig.contracts.propertyValuation) {
        throw new Error('PropertyValuation contract not initialized');
      }

      const valueInWei = ethers.parseEther(evaluatedValue.toString());

      // 트랜잭션 전송
      const result = await blockchainConfig.sendTransaction(
        blockchainConfig.contracts.propertyValuation,
        'completeValuation',
        [valuationId, valueInWei, confidenceScore]
      );

      return {
        success: result.status === 'success',
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      logger.error('Failed to complete valuation:', error);
      throw error;
    }
  }

  /**
   * 평가 정보 조회
   */
  static async getValuation(valuationId) {
    try {
      if (!blockchainConfig.contracts.propertyValuation) {
        throw new Error('PropertyValuation contract not initialized');
      }

      const valuation = await blockchainConfig.contracts.propertyValuation.getValuation(valuationId);
      
      return {
        valuationId: valuationId,
        propertyId: valuation[0].toString(),
        originalValue: ethers.formatEther(valuation[1]),
        evaluatedValue: ethers.formatEther(valuation[2]),
        confidenceScore: valuation[3].toString(),
        method: valuation[4],
        isCompleted: valuation[5]
      };
    } catch (error) {
      logger.error('Failed to get valuation:', error);
      throw error;
    }
  }

  /**
   * 네트워크 상태 조회
   */
  static async getNetworkStatus() {
    try {
      return await blockchainConfig.checkNetworkStatus();
    } catch (error) {
      logger.error('Failed to get network status:', error);
      throw error;
    }
  }

  /**
   * 가스비 추정
   */
  static async estimateGasCost(contractName, method, ...args) {
    try {
      const contract = blockchainConfig.contracts[contractName];
      if (!contract) {
        throw new Error(`Contract ${contractName} not found`);
      }

      return await blockchainConfig.estimateGas(contract, method, ...args);
    } catch (error) {
      logger.error('Failed to estimate gas cost:', error);
      throw error;
    }
  }

  /**
   * 트랜잭션 상태 조회
   */
  static async getTransactionStatus(txHash) {
    try {
      const receipt = await blockchainConfig.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return { status: 'pending', message: 'Transaction not yet mined' };
      }

      return {
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        confirmations: receipt.confirmations
      };
    } catch (error) {
      logger.error('Failed to get transaction status:', error);
      throw error;
    }
  }

  /**
   * 블록 정보 조회
   */
  static async getBlockInfo(blockNumber) {
    try {
      const block = await blockchainConfig.provider.getBlock(blockNumber);
      
      return {
        blockNumber: block.number,
        hash: block.hash,
        timestamp: new Date(block.timestamp * 1000),
        transactions: block.transactions.length,
        gasUsed: block.gasUsed.toString(),
        gasLimit: block.gasLimit.toString()
      };
    } catch (error) {
      logger.error('Failed to get block info:', error);
      throw error;
    }
  }
}

module.exports = BlockchainService; 