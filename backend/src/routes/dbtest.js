const express = require('express');
const router = express.Router();
const database = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const client = database.getClient ? database.getClient() : null;
    if (!client) {
      return res.status(200).json({ ok: true, connected: false });
    }
    const ping = await client.$queryRaw`SELECT 1`;
    res.json({ ok: true, connected: true, ping });
  } catch (e) {
    res.status(200).json({ ok: true, connected: false, error: e.message });
  }
});

module.exports = router;
