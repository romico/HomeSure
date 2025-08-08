const { body, param, query, validationResult } = require('express-validator');

/**
 * 유효성 검증 결과 처리 미들웨어
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Request data validation failed',
      details: errorMessages
    });
  }

  next();
};

/**
 * 사용자 등록 유효성 검증
 */
const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('유효한 이메일 주소를 입력해주세요')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('비밀번호는 최소 8자 이상이어야 합니다')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('이름은 1-50자 사이여야 합니다'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('성은 1-50자 사이여야 합니다'),
  body('phone')
    .optional()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('유효한 전화번호를 입력해주세요'),
  body('walletAddress')
    .optional()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('유효한 이더리움 주소를 입력해주세요'),
  handleValidationErrors
];

/**
 * 사용자 로그인 유효성 검증
 */
const validateUserLogin = [
  body('email')
    .isEmail()
    .withMessage('유효한 이메일 주소를 입력해주세요')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('비밀번호를 입력해주세요'),
  handleValidationErrors
];

/**
 * 부동산 생성 유효성 검증
 */
const validatePropertyCreation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('부동산 제목은 1-200자 사이여야 합니다'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('설명은 1000자 이하여야 합니다'),
  body('location')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('주소는 1-200자 사이여야 합니다'),
  body('city')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('도시명은 1-100자 사이여야 합니다'),
  body('country')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('국가명은 1-100자 사이여야 합니다'),
  body('postalCode')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('우편번호는 1-20자 사이여야 합니다'),
  body('propertyType')
    .isIn(['APARTMENT', 'HOUSE', 'COMMERCIAL', 'LAND', 'OFFICE', 'RETAIL', 'INDUSTRIAL', 'OTHER'])
    .withMessage('유효한 부동산 유형을 선택해주세요'),
  body('totalValue')
    .isFloat({ min: 0 })
    .withMessage('총 가치는 0보다 큰 숫자여야 합니다'),
  body('landArea')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('토지 면적은 0보다 큰 숫자여야 합니다'),
  body('buildingArea')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('건물 면적은 0보다 큰 숫자여야 합니다'),
  body('yearBuilt')
    .optional()
    .isInt({ min: 1800, max: new Date().getFullYear() })
    .withMessage('건축년도는 1800년 이후의 유효한 연도여야 합니다'),
  handleValidationErrors
];

/**
 * 부동산 업데이트 유효성 검증
 */
const validatePropertyUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('부동산 제목은 1-200자 사이여야 합니다'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('설명은 1000자 이하여야 합니다'),
  body('location')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('주소는 1-200자 사이여야 합니다'),
  body('city')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('도시명은 1-100자 사이여야 합니다'),
  body('country')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('국가명은 1-100자 사이여야 합니다'),
  body('postalCode')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('우편번호는 1-20자 사이여야 합니다'),
  body('propertyType')
    .optional()
    .isIn(['APARTMENT', 'HOUSE', 'COMMERCIAL', 'LAND', 'OFFICE', 'RETAIL', 'INDUSTRIAL', 'OTHER'])
    .withMessage('유효한 부동산 유형을 선택해주세요'),
  body('totalValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('총 가치는 0보다 큰 숫자여야 합니다'),
  body('landArea')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('토지 면적은 0보다 큰 숫자여야 합니다'),
  body('buildingArea')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('건물 면적은 0보다 큰 숫자여야 합니다'),
  body('yearBuilt')
    .optional()
    .isInt({ min: 1800, max: new Date().getFullYear() })
    .withMessage('건축년도는 1800년 이후의 유효한 연도여야 합니다'),
  handleValidationErrors
];

/**
 * 거래 생성 유효성 검증
 */
const validateTransactionCreation = [
  body('propertyId')
    .notEmpty()
    .withMessage('부동산 ID는 필수입니다'),
  body('toAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('유효한 이더리움 주소를 입력해주세요'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('거래 금액은 0보다 큰 숫자여야 합니다'),
  body('transactionType')
    .isIn(['TOKEN_PURCHASE', 'TOKEN_SALE', 'TOKEN_TRANSFER', 'PROPERTY_PURCHASE', 'PROPERTY_SALE', 'VALUATION_FEE', 'DISPUTE_FEE', 'OTHER'])
    .withMessage('유효한 거래 유형을 선택해주세요'),
  handleValidationErrors
];

/**
 * KYC 제출 유효성 검증
 */
const validateKYCSubmission = [
  body('documentType')
    .isIn(['REGISTRATION_CERTIFICATE', 'VALUATION_REPORT', 'CONTRACT', 'IDENTITY_DOCUMENT', 'PROOF_OF_ADDRESS', 'FINANCIAL_STATEMENT', 'OTHER'])
    .withMessage('유효한 문서 유형을 선택해주세요'),
  body('documentNumber')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('문서 번호는 1-100자 사이여야 합니다'),
  body('documentHash')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('문서 해시는 1-100자 사이여야 합니다'),
  handleValidationErrors
];

/**
 * 평가 생성 유효성 검증
 */
const validateValuationCreation = [
  body('propertyId')
    .notEmpty()
    .withMessage('부동산 ID는 필수입니다'),
  body('originalValue')
    .isFloat({ min: 0 })
    .withMessage('원래 가치는 0보다 큰 숫자여야 합니다'),
  body('method')
    .isIn(['COMPARABLE_SALES', 'INCOME_CAPITALIZATION', 'COST_APPROACH', 'DISCOUNTED_CASH_FLOW', 'AUTOMATED_MODEL', 'EXPERT_OPINION'])
    .withMessage('유효한 평가 방법을 선택해주세요'),
  body('reportHash')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('보고서 해시는 1-100자 사이여야 합니다'),
  handleValidationErrors
];

/**
 * 전문가 검증 유효성 검증
 */
const validateExpertReview = [
  body('valuationId')
    .notEmpty()
    .withMessage('평가 ID는 필수입니다'),
  body('isApproved')
    .isBoolean()
    .withMessage('승인 여부는 boolean 값이어야 합니다'),
  body('confidenceScore')
    .isInt({ min: 0, max: 100 })
    .withMessage('신뢰도 점수는 0-100 사이의 정수여야 합니다'),
  body('comments')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('코멘트는 1000자 이하여야 합니다'),
  handleValidationErrors
];

/**
 * ID 파라미터 유효성 검증
 */
const validateId = [
  param('id')
    .notEmpty()
    .withMessage('ID는 필수입니다'),
  handleValidationErrors
];

/**
 * 페이지네이션 쿼리 유효성 검증
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('페이지 번호는 1 이상의 정수여야 합니다'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('페이지 크기는 1-100 사이의 정수여야 합니다'),
  handleValidationErrors
];

/**
 * 검색 쿼리 유효성 검증
 */
const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('검색어는 1-100자 사이여야 합니다'),
  handleValidationErrors
];

/**
 * KYC 데이터 유효성 검증
 */
const validateKYCData = [
  body('userAddress')
    .notEmpty()
    .withMessage('사용자 주소는 필수입니다')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('유효한 이더리움 주소를 입력해주세요'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('이름은 1-50자 사이여야 합니다'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('성은 1-50자 사이여야 합니다'),
  body('dateOfBirth')
    .notEmpty()
    .withMessage('생년월일은 필수입니다')
    .isISO8601()
    .withMessage('유효한 날짜 형식을 입력해주세요'),
  body('nationality')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('국적은 1-100자 사이여야 합니다'),
  body('documentType')
    .isIn(['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID', 'RESIDENCE_PERMIT'])
    .withMessage('유효한 문서 유형을 선택해주세요'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validatePropertyCreation,
  validatePropertyUpdate,
  validateTransactionCreation,
  validateKYCSubmission,
  validateKYCData,
  validateValuationCreation,
  validateExpertReview,
  validateId,
  validatePagination,
  validateSearch
}; 