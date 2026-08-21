// utils/sendClockinEmail.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendMonthlyLeaderboardEmail = async (recipients, workspaceName, leaderboardData, startDate) => {
  const htmlContent = `
    <h2>🏆 Monthly Clock‑In Leaderboard</h2>
    <p>Workspace: <strong>${workspaceName}</strong></p>
    <p>Period: ${startDate.toLocaleDateString()} - ${new Date().toLocaleDateString()}</p>
    <p>Here are the top 5 members who clocked in early this month:</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #ddd;">Rank</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Member</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Early Clock‑Ins</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Avg Early Minutes</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Score</th>
        </tr>
      </thead>
      <tbody>
        ${leaderboardData.map((item, index) => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.user.name}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.earlyCount}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.avgEarlyMinutes} min</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${Math.round(item.score)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p style="margin-top: 20px;">Keep up the good work! 🎉</p>
  `;

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
      to: recipients,
      subject: `🏆 Monthly Clock‑In Leaderboard - ${workspaceName}`,
      html: htmlContent,
    });
    console.log('Monthly leaderboard email sent.');
  } catch (error) {
    console.error('Failed to send monthly leaderboard email:', error);
    throw error;
  }
};