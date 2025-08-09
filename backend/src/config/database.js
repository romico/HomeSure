const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.prisma = null;
  }

  async connect() {
    try {
      this.prisma = new PrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
          {
            emit: 'event',
            level: 'error',
          },
          {
            emit: 'event',
            level: 'info',
          },
          {
            emit: 'event',
            level: 'warn',
          },
        ],
      });

      // Log queries in development
      if (process.env.NODE_ENV === 'development') {
        this.prisma.$on('query', e => {
          logger.debug(`Query: ${e.query}`);
          logger.debug(`Params: ${e.params}`);
          logger.debug(`Duration: ${e.duration}ms`);
        });
      }

      // Log errors
      this.prisma.$on('error', e => {
        logger.error('Prisma Error:', e);
      });

      // Test connection
      await this.prisma.$connect();
      logger.info('✅ Database connected successfully');

      return this.prisma;
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.prisma) {
        await this.prisma.$disconnect();
        logger.info('✅ Database disconnected successfully');
      }
    } catch (error) {
      logger.error('❌ Database disconnection failed:', error);
      throw error;
    }
  }

  getClient() {
    if (!this.prisma) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.prisma) {
        return { status: 'not_connected', timestamp: new Date().toISOString() };
      }
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

// Singleton instance
const database = new Database();

module.exports = database;
