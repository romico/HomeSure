/**
 * 404 Not Found handler middleware
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
    availableEndpoints: {
      auth: '/api/auth',
      properties: '/api/properties',
      transactions: '/api/transactions',
      portfolio: '/api/portfolio',
      kyc: '/api/kyc',
      health: '/health',
      api: '/api'
    }
  });
};

module.exports = notFoundHandler; 