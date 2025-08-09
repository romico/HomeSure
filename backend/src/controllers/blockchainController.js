const ok = (res, data = {}, status = 200) => {
  res.status(status).json({ success: true, ...data });
};

const notImplemented = (res, name) => {
  ok(res, { message: `${name} not implemented` });
};

module.exports = {
  getNetworkStatus: async (req, res) => {
    ok(res, { status: 'unknown' });
  },

  getTokenBalance: async (req, res) => {
    const { address } = req.params;
    ok(res, { address, balance: '0' });
  },

  transferTokens: async (req, res) => notImplemented(res, 'transferTokens'),
  issueTokens: async (req, res) => notImplemented(res, 'issueTokens'),
  burnTokens: async (req, res) => notImplemented(res, 'burnTokens'),
  registerProperty: async (req, res) => notImplemented(res, 'registerProperty'),

  getProperty: async (req, res) => {
    const { propertyId } = req.params;
    ok(res, { propertyId, data: null });
  },

  getPropertyCount: async (req, res) => ok(res, { count: 0 }),

  updateOracleData: async (req, res) => notImplemented(res, 'updateOracleData'),

  getOracleData: async (req, res) => {
    const { propertyId, dataType } = req.params;
    ok(res, { propertyId, dataType, data: null });
  },

  createValuation: async (req, res) => notImplemented(res, 'createValuation'),
  completeValuation: async (req, res) => notImplemented(res, 'completeValuation'),

  getValuation: async (req, res) => {
    const { valuationId } = req.params;
    ok(res, { valuationId, data: null });
  },

  estimateGas: async (req, res) => ok(res, { estimate: '0' }),

  getTransactionStatus: async (req, res) => {
    const { txHash } = req.params;
    ok(res, { txHash, status: 'unknown' });
  },

  getBlockInfo: async (req, res) => {
    const { blockNumber } = req.params;
    ok(res, { blockNumber, info: null });
  },
};
