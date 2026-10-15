// utils/xircleMail.js
import { Resend } from 'resend';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS =
  process.env.XIRCLE_MAIL_FROM || 'Xircle <hello@xircle.app>';
const REPLY_TO = process.env.XIRCLE_MAIL_REPLY_TO || undefined;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:9000';

// Initialize once. If the key is missing we still construct an object so
// the app doesn't crash on import — sendEmail() will short-circuit instead.
let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn(
    '⚠️  [xircleMail] RESEND_API_KEY is not set — all email sends will be skipped.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOW-LEVEL SENDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an email through Resend.
 *
 * Always returns a result object — never throws — so callers can fire-and-forget
 * without wrapping in try/catch.
 *
 * @param {Object}  opts
 * @param {string}  opts.to           Recipient address
 * @param {string}  opts.subject      Email subject line
 * @param {string}  opts.html         HTML body
 * @param {string} [opts.text]        Optional plain-text fallback
 * @param {string} [opts.replyTo]     Optional Reply-To address
 * @param {string} [opts.from]        Optional override for the From header
 * @returns {Promise<{ success: boolean, id?: string, skipped?: boolean, error?: string }>}
 */
export async function sendEmail({ to, subject, html, text, replyTo, from }) {
  if (!to) {
    return { success: false, error: 'No recipient provided' };
  }
  if (!subject) {
    return { success: false, error: 'No subject provided' };
  }

  if (!resend) {
    console.log(`📭 [xircleMail] (skipped — no API key) → ${to} :: ${subject}`);
    return { success: false, skipped: true, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const payload = {
      from: from || FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || `<p>${text || ''}</p>`,
    };

    if (text) payload.text = text;
    if (replyTo || REPLY_TO) payload.reply_to = replyTo || REPLY_TO;

    const result = await resend.emails.send(payload);

    // Resend returns { data, error } on some SDK versions.
    if (result?.error) {
      console.error(
        `❌ [xircleMail] Resend error for ${to}:`,
        result.error.message || result.error
      );
      return { success: false, error: result.error.message || 'Resend error' };
    }

    const id = result?.data?.id || result?.id;
    console.log(`✅ [xircleMail] Sent to ${to} (id=${id || 'n/a'}) — "${subject}"`);
    return { success: true, id };
  } catch (err) {
    console.error(`❌ [xircleMail] Failed to send to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap body content in the Xircle-branded email shell.
 * Kept inline (no external CSS) so it renders in Gmail, Outlook, Apple Mail.
 */
function renderLayout({ title, preheader = '', bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  const cta =
    ctaLabel && ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
          <tr>
            <td align="center" bgcolor="#1a3a6b" style="border-radius:10px;">
              <a href="${ctaUrl}"
                 target="_blank"
                 style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;
                        color:#ffffff;text-decoration:none;border-radius:10px;font-family:Arial,
                        Helvetica,sans-serif;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
        </table>
      `
      : '';

  const footer = footerNote
    ? `<p style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:24px;">${footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>`
      : ''
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:#ffffff;border-radius:16px;
                      box-shadow:0 1px 3px rgba(15,23,42,0.06);overflow:hidden;">

          <!-- Brand bar -->
          <tr>
            <td style="background:#1a3a6b;padding:22px 28px;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">
                Xircle
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px 8px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;">
                ${title}
              </h1>
              <div style="font-size:15px;line-height:1.65;color:#334155;">
                ${bodyHtml}
              </div>
              ${cta}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:8px 28px 28px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px;" />
              <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
                You're receiving this because someone added you to a project on Xircle.
                If you believe this was a mistake, you can safely ignore this email.
              </p>
              ${footer}
              <p style="font-size:12px;color:#cbd5e1;margin:16px 0 0;">
                © ${new Date().getFullYear()} Xircle. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatExpiry = (date) => {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
};

const roleLabel = (role) => {
  switch (role) {
    case 'projectManager':
      return 'Project Manager';
    case 'editor':
      return 'Editor';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Associate';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1) ASSOCIATE INVITE — recipient has NO Xircle account yet
//
// Called from projectController.addAssociate when the email isn't found
// in the User collection. The recipient clicks the CTA, signs up, and
// userController.linkPendingAssociateInvites links them up automatically.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendAssociateInviteEmail({
  to,
  associateName = 'there',
  inviterName = 'A teammate',
  workspaceName = 'a workspace',
  projectName = 'a project',
  projectUrl,
  role = 'editor',
  expiresAt = null,
}) {
  if (!to) return { success: false, error: 'Recipient email is required' };

  const safeName = escapeHtml(associateName || 'there');
  const safeInviter = escapeHtml(inviterName || 'A teammate');
  const safeWorkspace = escapeHtml(workspaceName || 'a workspace');
  const safeProject = escapeHtml(projectName || 'a project');
  const safeRole = escapeHtml(roleLabel(role));
  const expiryLine = expiresAt
    ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">
         Access is valid until <strong>${escapeHtml(formatExpiry(expiresAt))}</strong>.
       </p>`
    : '';

  const finalUrl =
    projectUrl ||
    `${CLIENT_URL}/workspace`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${safeName},</p>
    <p style="margin:0 0 14px;">
      <strong>${safeInviter}</strong> added you as an
      <strong>${safeRole}</strong> on the project
      <strong>${safeProject}</strong> in the workspace
      <strong>${safeWorkspace}</strong>.
    </p>
    <p style="margin:0 0 14px;">
      Xircle is a collaborative workspace for teams. To view your project,
      tasks assigned to you, and collaborate in real time, click the button below.
    </p>
    <p style="margin:0 0 14px;padding:14px 16px;background:#f8fafc;border-radius:10px;
              font-size:14px;color:#475569;line-height:1.6;">
      <strong>What you'll be able to do</strong><br/>
      • View the project and any tasks assigned to you<br/>
      • Update progress on your tasks<br/>
      • Comment and collaborate in project chat
    </p>
    <p style="margin:0 0 0;font-size:14px;color:#475569;">
      Already have an Xircle account with this email? Just sign in — the project
      will appear on your dashboard automatically.
    </p>
    ${expiryLine}
  `;

  const html = renderLayout({
    title: `You've been added to "${safeProject}"`,
    preheader: `${safeInviter} added you to ${safeProject} on Xircle`,
    bodyHtml,
    ctaLabel: 'Open in Xircle',
    ctaUrl: finalUrl,
    footerNote: `If the button doesn't work, copy and paste this link into your browser:<br/>
                 <a href="${finalUrl}" style="color:#1a3a6b;word-break:break-all;">${finalUrl}</a>`,
  });

  const text = [
    `Hi ${associateName || 'there'},`,
    '',
    `${inviterName} added you as ${roleLabel(role)} on the project "${projectName}" in the workspace "${workspaceName}".`,
    '',
    'Open the project in Xircle:',
    finalUrl,
    '',
    expiresAt ? `Access is valid until ${formatExpiry(expiresAt)}.` : '',
    '',
    '— Xircle',
  ]
    .filter(Boolean)
    .join('\n');

  return sendEmail({
    to,
    subject: `${inviterName} added you to "${projectName}" on Xircle`,
    html,
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) ASSOCIATE LINKED — recipient HAS an Xircle account
//
// Sent when the person is already on Xircle and has just been added.
// No signup needed — they can jump straight in.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendAssociateLinkedEmail({
  to,
  associateName = 'there',
  inviterName = 'A teammate',
  workspaceName = 'a workspace',
  projectName = 'a project',
  projectUrl,
  role = 'editor',
  expiresAt = null,
}) {
  if (!to) return { success: false, error: 'Recipient email is required' };

  const safeName = escapeHtml(associateName || 'there');
  const safeInviter = escapeHtml(inviterName || 'A teammate');
  const safeWorkspace = escapeHtml(workspaceName || 'a workspace');
  const safeProject = escapeHtml(projectName || 'a project');
  const safeRole = escapeHtml(roleLabel(role));
  const expiryLine = expiresAt
    ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">
         Access is valid until <strong>${escapeHtml(formatExpiry(expiresAt))}</strong>.
       </p>`
    : '';

  const finalUrl =
    projectUrl ||
    `${CLIENT_URL}/workspace`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${safeName},</p>
    <p style="margin:0 0 14px;">
      <strong>${safeInviter}</strong> added you as an
      <strong>${safeRole}</strong> on the project
      <strong>${safeProject}</strong> in the workspace
      <strong>${safeWorkspace}</strong>.
    </p>
    <p style="margin:0 0 14px;">
      You can jump straight in — click the button below to open the project.
      Any tasks assigned to you will be waiting for you.
    </p>
    ${expiryLine}
  `;

  const html = renderLayout({
    title: `You've been added to "${safeProject}"`,
    preheader: `${safeInviter} added you to ${safeProject}`,
    bodyHtml,
    ctaLabel: 'Open project',
    ctaUrl: finalUrl,
    footerNote: `If the button doesn't work, copy and paste this link into your browser:<br/>
                 <a href="${finalUrl}" style="color:#1a3a6b;word-break:break-all;">${finalUrl}</a>`,
  });

  const text = [
    `Hi ${associateName || 'there'},`,
    '',
    `${inviterName} added you as ${roleLabel(role)} on the project "${projectName}" in the workspace "${workspaceName}".`,
    '',
    'Open the project:',
    finalUrl,
    '',
    expiresAt ? `Access is valid until ${formatExpiry(expiresAt)}.` : '',
    '',
    '— Xircle',
  ]
    .filter(Boolean)
    .join('\n');

  return sendEmail({
    to,
    subject: `You've been added to "${projectName}" on Xircle`,
    html,
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) ACCESS EXPIRING SOON — optional reminder before an associate loses access
//
// Wire this to a cron that runs daily and finds associate records where
// accessExpiresAt is between now+7d and now+8d. Not required for the
// feature to work — nice to have.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendAssociateAccessExpiringEmail({
  to,
  associateName = 'there',
  workspaceName = 'a workspace',
  projectName = 'a project',
  projectUrl,
  expiresAt,
}) {
  if (!to) return { success: false, error: 'Recipient email is required' };

  const safeName = escapeHtml(associateName || 'there');
  const safeWorkspace = escapeHtml(workspaceName || 'a workspace');
  const safeProject = escapeHtml(projectName || 'a project');
  const expiryText = escapeHtml(formatExpiry(expiresAt) || 'soon');

  const finalUrl = projectUrl || `${CLIENT_URL}/workspace`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${safeName},</p>
    <p style="margin:0 0 14px;">
      Heads up — your associate access to the project
      <strong>${safeProject}</strong> in the workspace
      <strong>${safeWorkspace}</strong> will expire on
      <strong>${expiryText}</strong>.
    </p>
    <p style="margin:0 0 14px;">
      If you still need access after that date, ask the project owner or a
      project manager to extend it. Any tasks you're working on should be
      wrapped up or reassigned before then.
    </p>
  `;

  const html = renderLayout({
    title: 'Your access is expiring soon',
    preheader: `Your access to ${safeProject} expires on ${expiryText}`,
    bodyHtml,
    ctaLabel: 'Open project',
    ctaUrl: finalUrl,
  });

  const text = [
    `Hi ${associateName || 'there'},`,
    '',
    `Your associate access to "${projectName}" in "${workspaceName}" expires on ${formatExpiry(expiresAt) || 'soon'}.`,
    '',
    `Open the project: ${finalUrl}`,
    '',
    '— Xircle',
  ].join('\n');

  return sendEmail({
    to,
    subject: `Your access to "${projectName}" expires on ${formatExpiry(expiresAt) || 'soon'}`,
    html,
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) GENERIC WORKSPACE INVITE (permanent members, via invite code)
//
// Kept here so all workspace-related mail is in one place. Currently the
// app routes permanent-member invites through teamController using
// createAndSendNotification — this can be wired in later if you want a
// richer email for that flow too.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendWorkspaceInviteEmail({
  to,
  inviteeName = 'there',
  inviterName = 'A teammate',
  workspaceName = 'a workspace',
  inviteCode,
}) {
  if (!to) return { success: false, error: 'Recipient email is required' };

  const safeName = escapeHtml(inviteeName || 'there');
  const safeInviter = escapeHtml(inviterName || 'A teammate');
  const safeWorkspace = escapeHtml(workspaceName || 'a workspace');
  const safeCode = escapeHtml(inviteCode || '');

  const signupUrl = `${CLIENT_URL}/signup?inviteCode=${encodeURIComponent(inviteCode || '')}`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${safeName},</p>
    <p style="margin:0 0 14px;">
      <strong>${safeInviter}</strong> invited you to join the workspace
      <strong>${safeWorkspace}</strong> on Xircle.
    </p>
    <p style="margin:0 0 14px;">
      Use the button below to create your account and join the workspace. Your
      invite code is:
    </p>
    <p style="margin:0 0 14px;padding:14px 16px;background:#f1f5f9;border-radius:10px;
              font-family:'Courier New',monospace;font-size:18px;letter-spacing:2px;
              text-align:center;color:#0f172a;font-weight:700;">
      ${safeCode}
    </p>
  `;

  const html = renderLayout({
    title: `You're invited to "${safeWorkspace}"`,
    preheader: `${safeInviter} invited you to ${safeWorkspace} on Xircle`,
    bodyHtml,
    ctaLabel: 'Accept invitation',
    ctaUrl: signupUrl,
  });

  const text = [
    `Hi ${inviteeName || 'there'},`,
    '',
    `${inviterName} invited you to join "${workspaceName}" on Xircle.`,
    `Your invite code: ${inviteCode}`,
    '',
    `Accept: ${signupUrl}`,
    '',
    '— Xircle',
  ].join('\n');

  return sendEmail({
    to,
    subject: `${inviterName} invited you to "${workspaceName}" on Xircle`,
    html,
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default {
  sendEmail,
  sendAssociateInviteEmail,
  sendAssociateLinkedEmail,
  sendAssociateAccessExpiringEmail,
  sendWorkspaceInviteEmail,
};