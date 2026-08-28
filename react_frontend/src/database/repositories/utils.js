// src/database/repositories/utils.js

/**
 * Safely parse JSON, returning null if invalid.
 */
export const parseJSON = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/**
 * Stringify JSON, returning null for empty.
 */
export const stringifyJSON = (value) => {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
};

/**
 * Convert a Date to milliseconds since epoch.
 */
export const toTimestamp = (date) => {
  if (!date) return null;
  if (typeof date === 'number') return date;
  return new Date(date).getTime();
};

/**
 * Convert a timestamp (ms) to Date object.
 */
export const toDate = (ts) => (ts ? new Date(ts) : null);