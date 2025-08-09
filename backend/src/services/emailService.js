const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  try {
    const t = getTransporter();
    const from = process.env.SMTP_FROM || 'no-reply@homesure.local';
    const info = await t.sendMail({ from, to, subject, text, html });
    logger.info(`Email sent: ${info.messageId} -> ${to}`);
    return info;
  } catch (error) {
    logger.error('Email send failed:', error);
    throw error;
  }
}

module.exports = { sendMail };
