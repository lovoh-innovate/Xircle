// utils/emailService.js
import { Resend } from 'resend';

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@lovohcreate.com';

if (!RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY is not set in environment variables. Email sending will fail.');
}

// Initialize Resend client
const resend = new Resend(RESEND_API_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE OTP
// ─────────────────────────────────────────────────────────────────────────────

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND EMAIL (core function)
// ─────────────────────────────────────────────────────────────────────────────

export const sendEmail = async ({ to, subject, html }) => {
  // Validate inputs
  if (!RESEND_API_KEY) {
    console.error('❌ Cannot send email: RESEND_API_KEY is missing');
    throw new Error('Email service is not configured. Please contact support.');
  }

  if (!to || !subject || !html) {
    throw new Error('Missing required email fields: to, subject, html');
  }

  console.log(`📧 Sending email to ${to} – subject: "${subject}"`);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('❌ Resend API error details:', JSON.stringify(error, null, 2));
      throw new Error(`Resend error: ${error.message || 'Unknown error'}`);
    }

    console.log(`✅ Email sent successfully to ${to} (ID: ${data?.id})`);
    return data;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP EMAIL TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const sendOTPEmail = async (email, otp, type = 'verification') => {
  const subject =
    type === 'verification'
      ? 'Verify Your Email - Xircle'
      : 'Reset Your Password - Xircle';

  const message =
    type === 'verification'
      ? `Your verification code is: <strong>${otp}</strong>. This code will expire in <strong>10 minutes</strong>.`
      : `Your password reset code is: <strong>${otp}</strong>. This code will expire in <strong>10 minutes</strong>.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #0d9488; margin: 0;">Xircle</h2>
        <p style="color: #666; font-size: 14px; margin: 0;">by LovohCreate</p>
      </div>
      <h3 style="color: #1a3a6b; margin-top: 0;">${type === 'verification' ? 'Verify Your Email' : 'Reset Your Password'}</h3>
      <p>Hello,</p>
      <p>${message}</p>
      <div style="background: #ffffff; padding: 16px; border-radius: 5px; text-align: center; font-size: 28px; letter-spacing: 6px; font-weight: bold; margin: 20px 0; border: 1px dashed #ccc;">
        ${otp}
      </div>
      <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
      <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">© 2026 Xircle. All rights reserved.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// DEVELOPMENT FALLBACK (optional) – uncomment to use console logging
// ─────────────────────────────────────────────────────────────────────────────
/*
export const sendOTPEmail = async (email, otp, type = 'verification') => {
  if (!RESEND_API_KEY || process.env.NODE_ENV === 'development') {
    console.log(`📝 [DEV] OTP for ${email} (${type}): ${otp}`);
    return { id: 'dev-' + Date.now() };
  }
  // ... actual send logic
};
*/