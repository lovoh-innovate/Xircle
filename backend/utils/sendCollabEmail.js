// utils/sendCollabEmail.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendCollaborationInvitationEmail = async ({ to, taskName, ownerName, inviteLink, existingUser }) => {
  const subject = `Invitation to collaborate on "${taskName}"`;
  const html = `
    <h2>Collaboration Invitation</h2>
    <p><strong>${ownerName}</strong> has invited you to collaborate on the task <strong>"${taskName}"</strong>.</p>
    <p>You will have ${existingUser ? 'access to view and manage' : 'access after you create an account'} this task.</p>
    <p>
      <a href="${inviteLink}" style="background: #0d9488; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
        ${existingUser ? 'View Invitation' : 'Create Account & Accept'}
      </a>
    </p>
    <p>If the button doesn't work, copy this link into your browser:</p>
    <p>${inviteLink}</p>
  `;

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'growth@lovohcreate.com',
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Failed to send collaboration email:', error);
    throw new Error('Failed to send invitation email.');
  }
};