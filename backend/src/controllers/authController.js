const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const TokenService = require('../services/tokenService');
const SessionService = require('../services/sessionService');

const prisma = new PrismaClient();

/**
 * 사용자 등록
 * @route POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, walletAddress } = req.body;

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists',
        message: '이미 등록된 이메일 주소입니다',
      });
    }

    // 지갑 주소 중복 확인
    if (walletAddress) {
      const existingWallet = await prisma.user.findUnique({
        where: { walletAddress },
      });

      if (existingWallet) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address already exists',
          message: '이미 등록된 지갑 주소입니다',
        });
      }
    }

    // 비밀번호 해싱
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        walletAddress,
        role: 'USER',
        kycStatus: 'PENDING',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        kycStatus: true,
        walletAddress: true,
        createdAt: true,
      },
    });

    // 세션 생성
    const session = await SessionService.createSession(user.id, req.get('User-Agent'), req.ip);

    // 토큰 쌍 생성
    const tokenPair = TokenService.generateTokenPair(user);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      message: '사용자 등록이 완료되었습니다',
      data: {
        user,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
      },
    });
  } catch (error) {
    logger.error('User registration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: '사용자 등록 중 오류가 발생했습니다',
    });
  }
};

/**
 * 사용자 로그인
 * @route POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: '이메일 또는 비밀번호가 올바르지 않습니다',
      });
    }

    // 계정 활성화 확인
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account deactivated',
        message: '비활성화된 계정입니다',
      });
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: '이메일 또는 비밀번호가 올바르지 않습니다',
      });
    }

    // 비정상적인 활동 감지
    const suspiciousActivity = await SessionService.detectSuspiciousActivity(
      user.id,
      req.ip,
      req.get('User-Agent')
    );

    // 세션 생성
    const session = await SessionService.createSession(user.id, req.get('User-Agent'), req.ip);

    // 토큰 쌍 생성
    const tokenPair = TokenService.generateTokenPair(user);

    // 응답 데이터에서 비밀번호 제외
    const { password: _, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      message: '로그인이 완료되었습니다',
      data: {
        user: userWithoutPassword,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        suspiciousActivity: suspiciousActivity.suspicious,
      },
    });
  } catch (error) {
    logger.error('User login failed:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: '로그인 중 오류가 발생했습니다',
    });
  }
};

/**
 * 현재 사용자 정보 조회
 * @route GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        postalCode: true,
        dateOfBirth: true,
        role: true,
        kycStatus: true,
        isActive: true,
        walletAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: '사용자를 찾을 수 없습니다',
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    logger.error('Get current user failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
      message: '사용자 정보 조회 중 오류가 발생했습니다',
    });
  }
};

/**
 * 사용자 로그아웃
 * @route POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // 토큰을 블랙리스트에 추가
      await TokenService.blacklistToken(token, 'logout');
    }

    // 현재 세션 종료
    if (req.sessionToken) {
      await SessionService.endSession(req.sessionToken);
    }

    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      success: true,
      message: '로그아웃이 완료되었습니다',
    });
  } catch (error) {
    logger.error('User logout failed:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      message: '로그아웃 중 오류가 발생했습니다',
    });
  }
};

/**
 * 토큰 갱신
 * @route POST /api/auth/refresh
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
        message: '리프레시 토큰이 필요합니다',
      });
    }

    // 세션 갱신
    const sessionResult = await SessionService.refreshSession(refreshToken);

    if (!sessionResult.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        message: '유효하지 않은 리프레시 토큰입니다',
      });
    }

    // 새로운 토큰 쌍 생성
    const tokenPair = TokenService.generateTokenPair(sessionResult.user);

    logger.info(`Token refreshed for user: ${sessionResult.user.email}`);

    res.json({
      success: true,
      message: '토큰이 갱신되었습니다',
      data: {
        accessToken: tokenPair.accessToken,
        refreshToken: sessionResult.session.refreshToken,
        expiresIn: tokenPair.expiresIn,
      },
    });
  } catch (error) {
    logger.error('Token refresh failed:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      message: '토큰 갱신 중 오류가 발생했습니다',
    });
  }
};

/**
 * 비밀번호 변경
 * @route PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 현재 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid current password',
        message: '현재 비밀번호가 올바르지 않습니다',
      });
    }

    // 새 비밀번호 해싱
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // 비밀번호 업데이트
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedNewPassword },
    });

    logger.info(`Password changed for user: ${user.email}`);

    res.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다',
    });
  } catch (error) {
    logger.error('Password change failed:', error);
    res.status(500).json({
      success: false,
      error: 'Password change failed',
      message: '비밀번호 변경 중 오류가 발생했습니다',
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  logout,
  refreshToken,
  changePassword,
};
