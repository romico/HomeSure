const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * 모든 부동산 조회 (페이지네이션, 필터링, 검색)
 * @route GET /api/properties
 */
const getAllProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      propertyType,
      status,
      minValue,
      maxValue,
      city,
      country,
      isTokenized
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // 필터 조건 구성
    const where = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (propertyType) {
      where.propertyType = propertyType;
    }

    if (status) {
      where.status = status;
    }

    if (minValue || maxValue) {
      where.totalValue = {};
      if (minValue) where.totalValue.gte = parseFloat(minValue);
      if (maxValue) where.totalValue.lte = parseFloat(maxValue);
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (country) {
      where.country = { contains: country, mode: 'insensitive' };
    }

    if (isTokenized !== undefined) {
      where.isTokenized = isTokenized === 'true';
    }

    // 부동산 조회
    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          documents: {
            where: { isActive: true },
            select: {
              id: true,
              documentType: true,
              fileName: true,
              isVerified: true
            }
          },
          _count: {
            select: {
              documents: true,
              valuations: true,
              transactions: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.property.count({ where })
    ]);

    const totalPages = Math.ceil(total / take);

    res.json({
      success: true,
      data: {
        properties,
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('Get all properties failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get properties',
      message: '부동산 목록 조회 중 오류가 발생했습니다'
    });
  }
};

/**
 * 특정 부동산 조회
 * @route GET /api/properties/:id
 */
const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        documents: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        },
        ownershipHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        valuations: {
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 5,
          include: {
            valuator: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            documents: true,
            valuations: true,
            transactions: true,
            ownershipHistory: true
          }
        }
      }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
        message: '부동산을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      data: { property }
    });
  } catch (error) {
    logger.error('Get property by ID failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get property',
      message: '부동산 조회 중 오류가 발생했습니다'
    });
  }
};

/**
 * 부동산 생성
 * @route POST /api/properties
 */
const createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      city,
      country,
      postalCode,
      propertyType,
      totalValue,
      landArea,
      buildingArea,
      yearBuilt,
      metadata
    } = req.body;

    const property = await prisma.property.create({
      data: {
        title,
        description,
        location,
        city,
        country,
        postalCode,
        propertyType,
        totalValue: parseFloat(totalValue),
        landArea: landArea ? parseFloat(landArea) : null,
        buildingArea: buildingArea ? parseFloat(buildingArea) : null,
        yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
        metadata: metadata || {},
        ownerId: req.user.id
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    logger.info(`Property created: ${property.title} by user: ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: '부동산이 성공적으로 등록되었습니다',
      data: { property }
    });
  } catch (error) {
    logger.error('Create property failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create property',
      message: '부동산 등록 중 오류가 발생했습니다'
    });
  }
};

/**
 * 부동산 업데이트
 * @route PUT /api/properties/:id
 */
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // 숫자 필드 변환
    if (updateData.totalValue) updateData.totalValue = parseFloat(updateData.totalValue);
    if (updateData.landArea) updateData.landArea = parseFloat(updateData.landArea);
    if (updateData.buildingArea) updateData.buildingArea = parseFloat(updateData.buildingArea);
    if (updateData.yearBuilt) updateData.yearBuilt = parseInt(updateData.yearBuilt);

    // 업데이트 시간 설정
    updateData.updatedAt = new Date();

    const property = await prisma.property.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    logger.info(`Property updated: ${property.title} by user: ${req.user.email}`);

    res.json({
      success: true,
      message: '부동산 정보가 성공적으로 업데이트되었습니다',
      data: { property }
    });
  } catch (error) {
    logger.error('Update property failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update property',
      message: '부동산 업데이트 중 오류가 발생했습니다'
    });
  }
};

/**
 * 부동산 삭제
 * @route DELETE /api/properties/:id
 */
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // 부동산 존재 확인
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactions: true,
            valuations: true
          }
        }
      }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
        message: '부동산을 찾을 수 없습니다'
      });
    }

    // 거래나 평가가 있는 경우 삭제 불가
    if (property._count.transactions > 0 || property._count.valuations > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete property',
        message: '거래 내역이나 평가 내역이 있는 부동산은 삭제할 수 없습니다'
      });
    }

    await prisma.property.delete({
      where: { id }
    });

    logger.info(`Property deleted: ${property.title} by user: ${req.user.email}`);

    res.json({
      success: true,
      message: '부동산이 성공적으로 삭제되었습니다'
    });
  } catch (error) {
    logger.error('Delete property failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete property',
      message: '부동산 삭제 중 오류가 발생했습니다'
    });
  }
};

/**
 * 부동산 토큰화
 * @route POST /api/properties/:id/tokenize
 */
const tokenizeProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const { tokenContractId } = req.body;

    // 부동산 상태 확인
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        documents: {
          where: { isVerified: true }
        },
        valuations: {
          where: { status: 'COMPLETED' }
        }
      }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
        message: '부동산을 찾을 수 없습니다'
      });
    }

    if (property.isTokenized) {
      return res.status(400).json({
        success: false,
        error: 'Property already tokenized',
        message: '이미 토큰화된 부동산입니다'
      });
    }

    if (property.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Property not active',
        message: '활성 상태가 아닌 부동산은 토큰화할 수 없습니다'
      });
    }

    // 검증된 문서가 있는지 확인
    if (property.documents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No verified documents',
        message: '검증된 문서가 필요합니다'
      });
    }

    // 완료된 평가가 있는지 확인
    if (property.valuations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No completed valuations',
        message: '완료된 평가가 필요합니다'
      });
    }

    // 토큰화 처리
    const updatedProperty = await prisma.property.update({
      where: { id },
      data: {
        isTokenized: true,
        tokenContractId,
        status: 'ACTIVE'
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    logger.info(`Property tokenized: ${property.title} by user: ${req.user.email}`);

    res.json({
      success: true,
      message: '부동산이 성공적으로 토큰화되었습니다',
      data: { property: updatedProperty }
    });
  } catch (error) {
    logger.error('Tokenize property failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to tokenize property',
      message: '부동산 토큰화 중 오류가 발생했습니다'
    });
  }
};

/**
 * 부동산 평가 정보 조회
 * @route GET /api/properties/:id/valuation
 */
const getPropertyValuation = async (req, res) => {
  try {
    const { id } = req.params;

    const valuations = await prisma.valuation.findMany({
      where: { propertyId: id },
      include: {
        valuator: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        expertReviews: {
          include: {
            expert: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        disputes: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (valuations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No valuations found',
        message: '평가 정보를 찾을 수 없습니다'
      });
    }

    // 최신 평가 정보
    const latestValuation = valuations[0];

    res.json({
      success: true,
      data: {
        latestValuation,
        allValuations: valuations,
        summary: {
          totalValuations: valuations.length,
          averageValue: valuations.reduce((sum, v) => sum + parseFloat(v.evaluatedValue || 0), 0) / valuations.length,
          highestValue: Math.max(...valuations.map(v => parseFloat(v.evaluatedValue || 0))),
          lowestValue: Math.min(...valuations.map(v => parseFloat(v.evaluatedValue || 0)))
        }
      }
    });
  } catch (error) {
    logger.error('Get property valuation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get valuation',
      message: '평가 정보 조회 중 오류가 발생했습니다'
    });
  }
};

module.exports = {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  tokenizeProperty,
  getPropertyValuation
}; 