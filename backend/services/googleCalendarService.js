// services/googleCalendarService.js
import { google } from 'googleapis';
import User from '../models/userModel.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const buildOAuthClient = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

export const getAuthUrl = (state) =>
  buildOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });

export const exchangeCodeForTokens = async (code) => {
  const { tokens } = await buildOAuthClient().getToken(code);
  return tokens;
};

/** Returns an authenticated OAuth client, or null if the user hasn't connected. */
export const getAuthedClient = async (userId) => {
  const user = await User.findById(userId)
    .select('+googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar');
  const gc = user?.googleCalendar;
  if (!gc?.enabled || !gc.refreshToken) return null;

  const client = buildOAuthClient();
  client.setCredentials({
    access_token:  gc.accessToken,
    refresh_token: gc.refreshToken,
    expiry_date:   gc.expiryDate,
  });

  // Auto-refresh 60 s before expiry
  if (gc.expiryDate && Date.now() >= gc.expiryDate - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    await User.findByIdAndUpdate(userId, {
      'googleCalendar.accessToken': credentials.access_token,
      'googleCalendar.expiryDate':  credentials.expiry_date,
    });
    client.setCredentials(credentials);
  }
  return client;
};

/** Turn a task into a Google Calendar event body. */
const buildEvent = (task) => {
  const event = {
    summary: task.title,
    description: [
      task.description,
      task.detailedDescription,
      `Priority: ${task.priority}`,
      `Status: ${task.status}`,
    ].filter(Boolean).join('\n\n'),
  };

  if (task.dueDate) {
    const end   = new Date(task.dueDate);
    const start = task.startDate
      ? new Date(task.startDate)
      : new Date(end.getTime() - 30 * 60 * 1000);
    event.start = { dateTime: start.toISOString() };
    event.end   = { dateTime: end.toISOString() };
  } else {
    // No dates → all-day event for today
    const today = new Date().toISOString().split('T')[0];
    event.start = { date: today };
    event.end   = { date: today };
  }
  return event;
};

export const createCalendarEvent = async (userId, task) => {
  const auth = await getAuthedClient(userId);
  if (!auth) return null;
  try {
    const cal = google.calendar({ version: 'v3', auth });
    const res = await cal.events.insert({
      calendarId: 'primary',
      requestBody: buildEvent(task),
    });
    return res.data.id;
  } catch (err) {
    console.error('createCalendarEvent failed:', err.message);
    return null;
  }
};

export const updateCalendarEvent = async (userId, eventId, task) => {
  const auth = await getAuthedClient(userId);
  if (!auth) return false;
  try {
    const cal = google.calendar({ version: 'v3', auth });
    await cal.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: buildEvent(task),
    });
    return true;
  } catch (err) {
    console.error('updateCalendarEvent failed:', err.message);
    return false;
  }
};

export const deleteCalendarEvent = async (userId, eventId) => {
  const auth = await getAuthedClient(userId);
  if (!auth) return false;
  try {
    const cal = google.calendar({ version: 'v3', auth });
    await cal.events.delete({ calendarId: 'primary', eventId });
    return true;
  } catch (err) {
    console.error('deleteCalendarEvent failed:', err.message);
    return false;
  }
};