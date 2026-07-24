import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends an email via Resend.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML body of the email
 * @returns {Promise<Object>} Resend response
 */
export const sendEmail = async (to, subject, html) => {
  if (!to || !subject || !html) {
    throw new Error('Missing required email fields');
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'noreply@lovohcreate.com', // your verified domain in Resend
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(error.message);
    }

    console.log(`✅ Email sent to ${to}: ${data?.id}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    throw error;
  }
};