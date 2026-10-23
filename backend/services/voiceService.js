// services/voiceService.js
//
// Groq-only voice layer.
//   • STT  → whisper-large-v3-turbo
//   • TTS  → canopylabs/orpheus-v1-english (wav)
//
// One API key (GROQ_API_KEY) powers the entire AI call stack:
// transcription, summarization, Q&A, and spoken answers.

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ── Endpoints ─────────────────────────────────────────────────
const STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const TTS_URL = 'https://api.groq.com/openai/v1/audio/speech';

// ── Models ────────────────────────────────────────────────────
const STT_MODEL = 'whisper-large-v3-turbo';
const TTS_MODEL = 'canopylabs/orpheus-v1-english';

// Orpheus hard-caps a single request at 200 characters.
const TTS_MAX_CHARS = 200;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Split long text into ≤200-char chunks, preferring sentence
 * boundaries so each TTS clip sounds natural.
 *
 * Returns an array of non-empty strings.
 */
function chunkTextForTTS(text, maxLen = TTS_MAX_CHARS) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?]+[.!?]*/g) || [clean];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;

    // A single sentence longer than the limit → hard-split it.
    if (s.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < s.length; i += maxLen) {
        chunks.push(s.slice(i, i + maxLen));
      }
      continue;
    }

    // Would adding this sentence overflow the current chunk?
    if (current && current.length + 1 + s.length > maxLen) {
      chunks.push(current);
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

/**
 * Call the Groq TTS endpoint once for a single ≤200-char chunk.
 * Returns a Buffer containing a complete WAV file.
 */
async function synthesizeOneChunk({ text, voice, responseFormat }) {
  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: text,
      voice,
      response_format: responseFormat,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(
      `TTS failed (${res.status}): ${errBody.slice(0, 300) || res.statusText}`
    );
  }

  return Buffer.from(await res.arrayBuffer());
}

// ═════════════════════════════════════════════════════════════
// STT — Speech to Text
// ═════════════════════════════════════════════════════════════
/**
 * Transcribe an audio buffer using Groq Whisper.
 *
 * @param {Object}  opts
 * @param {Buffer}  opts.buffer       Raw audio bytes (webm, wav, mp3, m4a, …)
 * @param {string} [opts.mimeType]    e.g. 'audio/webm'
 * @param {string} [opts.language]    ISO language hint (optional)
 * @param {string} [opts.prompt]      Vocab hint — names, product jargon, etc.
 * @returns {Promise<{ text: string, language: string|null, durationSec: number|null }>}
 */
export async function transcribeAudio({
  buffer,
  mimeType = 'audio/webm',
  language,
  prompt,
}) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');
  if (!buffer?.length) return { text: '', language: null, durationSec: null };

  const form = new FormData();
  // Use a generic filename; Whisper relies on the blob MIME type,
  // not the extension, but a sensible name avoids odd edge cases.
  const ext = mimeType.includes('wav')
    ? 'wav'
    : mimeType.includes('mp3')
    ? 'mp3'
    : mimeType.includes('m4a')
    ? 'm4a'
    : 'webm';
  form.append('file', new Blob([buffer], { type: mimeType }), `audio.${ext}`);
  form.append('model', STT_MODEL);
  form.append('response_format', 'json');
  form.append('temperature', '0');

  if (language) form.append('language', language);
  // A short prompt containing real names / jargon dramatically
  // improves Whisper’s accuracy on team calls.
  if (prompt) form.append('prompt', String(prompt).slice(0, 400));

  const res = await fetch(STT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(
      `STT failed (${res.status}): ${errBody.slice(0, 300) || res.statusText}`
    );
  }

  const data = await res.json();
  return {
    text: (data.text || '').trim(),
    language: data.language || null,
    durationSec: data.duration || null,
  };
}

// ═════════════════════════════════════════════════════════════
// TTS — Text to Speech
// ═════════════════════════════════════════════════════════════
/**
 * Convert text to speech using Groq Orpheus.
 *
 * Long text is automatically split into ≤200-character chunks;
 * each chunk becomes a separate WAV buffer. The caller can play
 * them sequentially (recommended for barge-in) or concatenate
 * them into one buffer.
 *
 * @param {Object}  opts
 * @param {string}  opts.text            Text to speak
 * @param {string} [opts.voice]          Orpheus voice ID (default: env or 'hannah')
 * @param {string} [opts.format]         Only 'wav' is supported today
 * @returns {Promise<{
 *   audio: Buffer,              // first chunk (or only chunk)
 *   segments: Buffer[],         // every chunk, in order
 *   format: string,
 *   provider: 'groq',
 *   chunkCount: number,
 *   truncated: boolean,         // true if input exceeded safety cap
 * }>}
 */
export async function synthesizeSpeech({
  text,
  voice = process.env.GROQ_TTS_VOICE || 'hannah',
  format = 'wav',
}) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');

  const clean = String(text || '').trim();
  if (!clean) throw new Error('No text to synthesize.');

  // Safety: never send more than 20 chunks (≈4,000 chars) in one
  // API call. Meeting answers should be far shorter anyway.
  const rawChunks = chunkTextForTTS(clean);
  const truncated = rawChunks.length > 20;
  const chunks = truncated ? rawChunks.slice(0, 20) : rawChunks;

  if (chunks.length === 0) {
    throw new Error('Text produced no speakable chunks.');
  }

  // Only 'wav' is accepted by Orpheus today. Default + enforce.
  const responseFormat = 'wav';

  const segments = [];
  for (const chunk of chunks) {
    const buf = await synthesizeOneChunk({
      text: chunk,
      voice,
      responseFormat,
    });
    segments.push(buf);
  }

  // For convenience, expose the first segment as `audio` so callers
  // that only need a short answer can ignore `segments`.
  return {
    audio: segments[0],
    segments,
    format: responseFormat,
    provider: 'groq',
    chunkCount: segments.length,
    truncated,
  };
}

/**
 * Convenience wrapper that returns a single concatenated WAV buffer.
 *
 * Note: concatenating WAV files technically produces multiple RIFF
 * headers. Most browsers and players tolerate this, but if you
 * experience issues, play `segments` sequentially instead.
 */
export async function synthesizeSpeechSingleBuffer(opts) {
  const result = await synthesizeSpeech(opts);
  if (result.segments.length === 1) return result.audio;
  return Buffer.concat(result.segments);
}