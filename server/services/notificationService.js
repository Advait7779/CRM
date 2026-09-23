const nodemailer = require('nodemailer');
require('../config/env');

// Nodemailer setup
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
  port: process.env.EMAIL_PORT || 2525,
  connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 5000),
  greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 5000),
  socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 10000),
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

/**
 * Sends a multi-channel alert (WhatsApp, SMS, Email, RCS, Voice)
 * based on integration settings. Since API keys are pending,
 * this logs the delivery information and simulates a successful dispatch.
 */
const sendMultiChannelNotification = async ({ toEmail, toPhone, subject, textContent, channels = ['email', 'sms', 'whatsapp'] }) => {
  const logPrefix = `[Notification Gateway]`;
  console.log(`${logPrefix} Preparing alert dispatch to Email: ${toEmail || 'N/A'}, Phone: ${toPhone || 'N/A'}`);

  const results = {};

  // 1. Email Channel
  if (channels.includes('email') && toEmail) {
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail({
          from: `"ServicePro" <${process.env.EMAIL_USER}>`,
          to: toEmail,
          subject: subject,
          text: textContent
        });
        console.log(`${logPrefix} Email successfully sent via SMTP to ${toEmail}`);
      } else {
        console.log(`${logPrefix} Email skipped because SMTP is not configured for ${toEmail}: "${subject}"`);
        results.email = 'Skipped: SMTP is not configured';
      }
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) results.email = 'Delivered';
    } catch (err) {
      console.error(`${logPrefix} Email delivery failed:`, err.message);
      results.email = 'Failed';
    }
  }

  // 2. WhatsApp Channel
  if (channels.includes('whatsapp') && toPhone) {
    console.log(`${logPrefix} WhatsApp skipped: provider adapter is not configured.`);
    results.whatsapp = 'Skipped: provider adapter is not configured';
  }

  // 3. SMS Channel
  if (channels.includes('sms') && toPhone) {
    // Simulate SMS Gateway integration (Msg91, Fast2SMS, Textlocal, etc.)
    console.log(`${logPrefix} SMS skipped: provider adapter is not configured.`);
    results.sms = 'Skipped: provider adapter is not configured';
  }

  // 4. RCS Channel (Rich Communication Services)
  if (channels.includes('rcs') && toPhone) {
    console.log(`${logPrefix} RCS skipped: provider adapter is not configured.`);
    results.rcs = 'Skipped: provider adapter is not configured';
  }

  // 5. Voice Call Channel
  if (channels.includes('voice') && toPhone) {
    console.log(`${logPrefix} Voice call skipped: provider adapter is not configured.`);
    results.voice = 'Skipped: provider adapter is not configured';
  }

  return results;
};

module.exports = { sendMultiChannelNotification };
