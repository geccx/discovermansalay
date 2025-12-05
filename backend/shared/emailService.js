// backend/shared/emailService.js
const brevo = require("@getbrevo/brevo");

const brevoClient = new brevo.TransactionalEmailsApi();
brevoClient.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

const SENDER = {
  email: process.env.SMTP_FROM, // 9d6ee5001@newsletter.brevo.com
  name: "Discover Mansalay"
};

/**
 * Global email sender using Brevo API
 */
async function sendEmail(to, subject, html, attachments = []) {
  try {
    await brevoClient.sendTransacEmail({
      sender: SENDER,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: attachments
    });

    console.log("📩 Email sent:", to);
    return true;
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    return false;
  }
}

module.exports = { sendEmail };
