// services/scriptureSeeder.js
//
// One-time background seeders for the local Bible / Quran caches.
//
//   • seedBibleTranslation(translation)  — walks all 1,189 chapters
//   • seedQuranEdition(edition)          — walks all 114 surahs
//   • bootstrapScriptureSeeder()         — call from server startup
//
// Both seeders are IDEMPOTENT — every chapter / surah is existence-checked
// before a network call, so re-running resumes exactly where it stopped.
//
// RATE-LIMIT AWARE:
//   • bible-api.com throttles anonymous traffic at ~15 req / 30 s
//   • the Bible seeder defaults to a 2.5 s delay (well under the cap)
//   • on HTTP 429 it backs off exponentially and cools down globally
//   • the Quran API (alquran.cloud) is more generous — 350 ms is fine
//
// Env vars:
//   DISABLE_SCRIPTURE_SEEDING=true    → no-op the bootstrap
//   BIBLE_TRANSLATION=kjv             → translation to seed
//   QURAN_EDITION=en.asad             → edition to seed
//   SCRIPTURE_SEED_DELAY_MS=2500      → Bible delay between calls
//   QURAN_SEED_DELAY_MS=350           → Quran delay between calls

import mongoose from 'mongoose';
import BibleChapter from '../models/bibleModel.js';
import QuranSurah from '../models/quranModel.js';

const BIBLE_API = 'https://bible-api.com';
const QURAN_API = 'https://api.alquran.cloud/v1';

// ─────────────────────────────────────────────────────────────────────
// Bible canon — KJV chapter counts (66 books, 1,189 chapters).
// ─────────────────────────────────────────────────────────────────────
export const BIBLE_BOOKS = [
  { name: 'Genesis',           id: 'genesis',        chapters: 50,  testament: 'OT' },
  { name: 'Exodus',            id: 'exodus',         chapters: 40,  testament: 'OT' },
  { name: 'Leviticus',         id: 'leviticus',      chapters: 27,  testament: 'OT' },
  { name: 'Numbers',           id: 'numbers',        chapters: 36,  testament: 'OT' },
  { name: 'Deuteronomy',       id: 'deuteronomy',    chapters: 34,  testament: 'OT' },
  { name: 'Joshua',            id: 'joshua',         chapters: 24,  testament: 'OT' },
  { name: 'Judges',            id: 'judges',         chapters: 21,  testament: 'OT' },
  { name: 'Ruth',              id: 'ruth',           chapters: 4,   testament: 'OT' },
  { name: '1 Samuel',          id: '1-samuel',       chapters: 31,  testament: 'OT' },
  { name: '2 Samuel',          id: '2-samuel',       chapters: 24,  testament: 'OT' },
  { name: '1 Kings',           id: '1-kings',        chapters: 22,  testament: 'OT' },
  { name: '2 Kings',           id: '2-kings',        chapters: 25,  testament: 'OT' },
  { name: '1 Chronicles',      id: '1-chronicles',   chapters: 29,  testament: 'OT' },
  { name: '2 Chronicles',      id: '2-chronicles',   chapters: 36,  testament: 'OT' },
  { name: 'Ezra',              id: 'ezra',           chapters: 10,  testament: 'OT' },
  { name: 'Nehemiah',          id: 'nehemiah',       chapters: 13,  testament: 'OT' },
  { name: 'Esther',            id: 'esther',         chapters: 10,  testament: 'OT' },
  { name: 'Job',               id: 'job',            chapters: 42,  testament: 'OT' },
  { name: 'Psalms',            id: 'psalms',         chapters: 150, testament: 'OT' },
  { name: 'Proverbs',          id: 'proverbs',       chapters: 31,  testament: 'OT' },
  { name: 'Ecclesiastes',      id: 'ecclesiastes',   chapters: 12,  testament: 'OT' },
  { name: 'Song of Solomon',   id: 'song-of-solomon',chapters: 8,   testament: 'OT' },
  { name: 'Isaiah',            id: 'isaiah',         chapters: 66,  testament: 'OT' },
  { name: 'Jeremiah',          id: 'jeremiah',       chapters: 52,  testament: 'OT' },
  { name: 'Lamentations',      id: 'lamentations',   chapters: 5,   testament: 'OT' },
  { name: 'Ezekiel',           id: 'ezekiel',        chapters: 48,  testament: 'OT' },
  { name: 'Daniel',            id: 'daniel',         chapters: 12,  testament: 'OT' },
  { name: 'Hosea',             id: 'hosea',          chapters: 14,  testament: 'OT' },
  { name: 'Joel',              id: 'joel',           chapters: 3,   testament: 'OT' },
  { name: 'Amos',              id: 'amos',           chapters: 9,   testament: 'OT' },
  { name: 'Obadiah',           id: 'obadiah',        chapters: 1,   testament: 'OT' },
  { name: 'Jonah',             id: 'jonah',          chapters: 4,   testament: 'OT' },
  { name: 'Micah',             id: 'micah',          chapters: 7,   testament: 'OT' },
  { name: 'Nahum',             id: 'nahum',          chapters: 3,   testament: 'OT' },
  { name: 'Habakkuk',          id: 'habakkuk',       chapters: 3,   testament: 'OT' },
  { name: 'Zephaniah',         id: 'zephaniah',      chapters: 3,   testament: 'OT' },
  { name: 'Haggai',            id: 'haggai',          chapters: 2,   testament: 'OT' },
  { name: 'Zechariah',         id: 'zechariah',      chapters: 14,  testament: 'OT' },
  { name: 'Malachi',           id: 'malachi',        chapters: 4,   testament: 'OT' },

  { name: 'Matthew',           id: 'matthew',        chapters: 28,  testament: 'NT' },
  { name: 'Mark',              id: 'mark',           chapters: 16,  testament: 'NT' },
  { name: 'Luke',              id: 'luke',           chapters: 24,  testament: 'NT' },
  { name: 'John',              id: 'john',           chapters: 21,  testament: 'NT' },
  { name: 'Acts',              id: 'acts',           chapters: 28,  testament: 'NT' },
  { name: 'Romans',            id: 'romans',         chapters: 16,  testament: 'NT' },
  { name: '1 Corinthians',     id: '1-corinthians',  chapters: 16,  testament: 'NT' },
  { name: '2 Corinthians',     id: '2-corinthians',  chapters: 13,  testament: 'NT' },
  { name: 'Galatians',         id: 'galatians',      chapters: 6,   testament: 'NT' },
  { name: 'Ephesians',         id: 'ephesians',      chapters: 6,   testament: 'NT' },
  { name: 'Philippians',       id: 'philippians',    chapters: 4,   testament: 'NT' },
  { name: 'Colossians',        id: 'colossians',     chapters: 4,   testament: 'NT' },
  { name: '1 Thessalonians',   id: '1-thessalonians',chapters: 5,   testament: 'NT' },
  { name: '2 Thessalonians',   id: '2-thessalonians',chapters: 3,   testament: 'NT' },
  { name: '1 Timothy',         id: '1-timothy',      chapters: 6,   testament: 'NT' },
  { name: '2 Timothy',         id: '2-timothy',      chapters: 4,   testament: 'NT' },
  { name: 'Titus',             id: 'titus',          chapters: 3,   testament: 'NT' },
  { name: 'Philemon',          id: 'philemon',       chapters: 1,   testament: 'NT' },
  { name: 'Hebrews',           id: 'hebrews',        chapters: 13,  testament: 'NT' },
  { name: 'James',             id: 'james',          chapters: 5,   testament: 'NT' },
  { name: '1 Peter',           id: '1-peter',        chapters: 5,   testament: 'NT' },
  { name: '2 Peter',           id: '2-peter',        chapters: 3,   testament: 'NT' },
  { name: '1 John',            id: '1-john',         chapters: 5,   testament: 'NT' },
  { name: '2 John',            id: '2-john',         chapters: 1,   testament: 'NT' },
  { name: '3 John',            id: '3-john',         chapters: 1,   testament: 'NT' },
  { name: 'Jude',              id: 'jude',           chapters: 1,   testament: 'NT' },
  { name: 'Revelation',        id: 'revelation',     chapters: 22,  testament: 'NT' },
];

const QURAN_SURAH_TOTAL = 114;

// Defaults tuned for each API's published rate limit.
const DEFAULT_BIBLE_DELAY_MS = 2500; // bible-api.com ≈ 15 req / 30 s
const DEFAULT_QURAN_DELAY_MS = 350;  // alquran.cloud is generous

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────
// Shared progress state — exported so you can inspect from anywhere.
// ─────────────────────────────────────────────────────────────────────
export const seedState = {
  bible: {
    running: false,
    translation: null,
    seeded: 0,
    total: BIBLE_BOOKS.reduce((sum, b) => sum + b.chapters, 0),
    errors: 0,
    finished: false,
    cooldownUntil: 0,
  },
  quran: {
    running: false,
    edition: null,
    seeded: 0,
    total: QURAN_SURAH_TOTAL,
    errors: 0,
    finished: false,
    cooldownUntil: 0,
  },
};

// ─────────────────────────────────────────────────────────────────────
// fetchWithRetry
//
// Handles 429 / 5xx with exponential backoff. Reads Retry-After if the
// server sends one. Also applies a *global* cooldown to the seeder, so
// if we just got throttled, the next chapter waits it out instead of
// hammering the API and digging the hole deeper.
// ─────────────────────────────────────────────────────────────────────
async function fetchWithRetry(
  url,
  { maxAttempts = 4, baseDelayMs = 4000, label = 'request' } = {}
) {
  let attempt = 0;
  let lastErr;

  while (attempt < maxAttempts) {
    attempt++;

    // Respect any global cooldown before firing.
    const now = Date.now();
    if (cooldownUntil > now) {
      const wait = cooldownUntil - now;
      console.log(`   ⏸️  Cooling down for ${Math.round(wait / 1000)}s before ${label}…`);
      await sleep(wait);
    }

    try {
      const res = await fetch(url);

      if (res.ok) return res;

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        // Retry-After is either seconds or an HTTP date — handle both.
        const ra = res.headers.get('retry-after');
        let waitMs = baseDelayMs * Math.pow(2, attempt - 1); // 4s, 8s, 16s, 32s
        if (ra) {
          const asNum = Number(ra);
          if (Number.isFinite(asNum) && asNum > 0) {
            waitMs = Math.max(waitMs, asNum * 1000);
          } else {
            const asDate = Date.parse(ra);
            if (!Number.isNaN(asDate)) {
              waitMs = Math.max(waitMs, asDate - Date.now());
            }
          }
        }
        waitMs = Math.min(waitMs, 60_000); // never wait more than a minute

        // Extend the global cooldown so the next chapter also waits.
        cooldownUntil = Math.max(cooldownUntil, Date.now() + waitMs);

        console.warn(
          `   🔁 ${label} → HTTP ${res.status}, backing off ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`
        );
        await sleep(waitMs);
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }

      // Non-retryable (404, 400, …)
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      // Network error — brief retry before giving up.
      if (attempt < maxAttempts && !/HTTP \d/.test(err.message)) {
        const waitMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `   🔁 ${label} network error (${err.message}), retrying in ${Math.round(waitMs / 1000)}s…`
        );
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('fetchWithRetry exhausted retries');
}

// Module-level cooldown shared between retry calls.
let cooldownUntil = 0;

// ─────────────────────────────────────────────────────────────────────
// BIBLE
// ─────────────────────────────────────────────────────────────────────
export async function seedBibleTranslation(
  translation = 'kjv',
  { delayMs = DEFAULT_BIBLE_DELAY_MS, logEvery = 25 } = {}
) {
  if (seedState.bible.running) {
    console.log('ℹ️  Bible seeder already running.');
    return;
  }
  seedState.bible.running = true;
  seedState.bible.finished = false;
  seedState.bible.translation = translation;
  seedState.bible.seeded = 0;
  seedState.bible.errors = 0;
  cooldownUntil = 0;

  const totalChapters = seedState.bible.total;
  console.log(
    `📖 Bible seeder starting (${translation}) — ${totalChapters} chapters @ ${delayMs} ms.`
  );

  try {
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        // Skip if already stored.
        const exists = await BibleChapter.exists({
          translation,
          book: book.name,
          chapter,
        });

        if (exists) {
          seedState.bible.seeded++;
          continue;
        }

        try {
          const url = `${BIBLE_API}/${encodeURIComponent(
            `${book.name} ${chapter}`
          )}?translation=${translation}`;

          const res = await fetchWithRetry(url, {
            label: `Bible ${book.name} ${chapter}`,
          });
          const data = await res.json();

          const verses = (data.verses || []).map((v) => ({
            verse: v.verse,
            text: (v.text || '').trim(),
          }));

          if (!verses.length) {
            seedState.bible.errors++;
            console.warn(`⚠️  Bible ${book.name} ${chapter}: empty response, skipping.`);
          } else {
            await BibleChapter.updateOne(
              { translation, book: book.name, chapter },
              {
                $set: {
                  translation,
                  translationName:
                    data.translation_name || translation.toUpperCase(),
                  book: book.name,
                  bookId: book.id,
                  testament: book.testament,
                  chapter,
                  verses,
                  verseCount: verses.length,
                  fetchedAt: new Date(),
                },
              },
              { upsert: true }
            );
            seedState.bible.seeded++;
          }
        } catch (err) {
          seedState.bible.errors++;
          console.warn(
            `⚠️  Bible seed failed for ${book.name} ${chapter}: ${err.message}`
          );
        }

        if (seedState.bible.seeded % logEvery === 0) {
          console.log(
            `   📖 ${seedState.bible.seeded}/${totalChapters} chapters (${seedState.bible.errors} errors)`
          );
        }

        if (delayMs) await sleep(delayMs);
      }
    }

    seedState.bible.finished = true;
    console.log(
      `✅ Bible seeder finished (${translation}): ${seedState.bible.seeded}/${totalChapters}, ${seedState.bible.errors} errors.`
    );
    if (seedState.bible.errors > 0) {
      console.log(
        '   ℹ️  Some chapters failed. Re-run the app to retry only the missing ones.'
      );
    }
  } finally {
    seedState.bible.running = false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// QURAN
// ─────────────────────────────────────────────────────────────────────
export async function seedQuranEdition(
  edition = 'en.asad',
  { delayMs = DEFAULT_QURAN_DELAY_MS, logEvery = 10 } = {}
) {
  if (seedState.quran.running) {
    console.log('ℹ️  Quran seeder already running.');
    return;
  }
  seedState.quran.running = true;
  seedState.quran.finished = false;
  seedState.quran.edition = edition;
  seedState.quran.seeded = 0;
  seedState.quran.errors = 0;

  console.log(
    `📖 Quran seeder starting (${edition}) — ${QURAN_SURAH_TOTAL} surahs @ ${delayMs} ms.`
  );

  try {
    for (let surah = 1; surah <= QURAN_SURAH_TOTAL; surah++) {
      const exists = await QuranSurah.exists({ edition, surahNumber: surah });
      if (exists) {
        seedState.quran.seeded++;
        continue;
      }

      try {
        const res = await fetchWithRetry(
          `${QURAN_API}/surah/${surah}/${edition}`,
          { label: `Quran surah ${surah}`, baseDelayMs: 2000 }
        );
        const data = await res.json();
        const s = data.data;

        const ayahs = (s.ayahs || []).map((a) => ({
          ayah: a.numberInSurah,
          text: a.text,
        }));

        if (!ayahs.length) {
          seedState.quran.errors++;
          console.warn(`⚠️  Quran surah ${surah}: empty response, skipping.`);
        } else {
          await QuranSurah.updateOne(
            { edition, surahNumber: surah },
            {
              $set: {
                edition,
                editionName: s.edition?.englishName || edition,
                surahNumber: surah,
                name: s.name || '',
                englishName: s.englishName || '',
                englishNameTranslation: s.englishNameTranslation || '',
                revelationType: s.revelationType || '',
                ayahCount: ayahs.length,
                ayahs,
                fetchedAt: new Date(),
              },
            },
            { upsert: true }
          );
          seedState.quran.seeded++;
        }
      } catch (err) {
        seedState.quran.errors++;
        console.warn(`⚠️  Quran seed failed for surah ${surah}: ${err.message}`);
      }

      if (surah % logEvery === 0) {
        console.log(
          `   📖 Quran ${surah}/${QURAN_SURAH_TOTAL} surahs (${seedState.quran.errors} errors)`
        );
      }

      if (delayMs) await sleep(delayMs);
    }

    seedState.quran.finished = true;
    console.log(
      `✅ Quran seeder finished (${edition}): ${seedState.quran.seeded}/${QURAN_SURAH_TOTAL}, ${seedState.quran.errors} errors.`
    );
  } finally {
    seedState.quran.running = false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOOTSTRAP — call once at server startup. Auto-safe on repeated calls.
// ─────────────────────────────────────────────────────────────────────
let _bootstrapped = false;

export function bootstrapScriptureSeeder(opts = {}) {
  if (_bootstrapped) return;
  _bootstrapped = true;

  if (String(process.env.DISABLE_SCRIPTURE_SEEDING).toLowerCase() === 'true') {
    console.log('ℹ️  Scripture seeding disabled via DISABLE_SCRIPTURE_SEEDING.');
    return;
  }

  const translation = process.env.BIBLE_TRANSLATION || opts.translation || 'kjv';
  const edition = process.env.QURAN_EDITION || opts.edition || 'en.asad';

  const bibleDelay =
    Number(process.env.SCRIPTURE_SEED_DELAY_MS) ||
    opts.bibleDelayMs ||
    DEFAULT_BIBLE_DELAY_MS;
  const quranDelay =
    Number(process.env.QURAN_SEED_DELAY_MS) ||
    opts.quranDelayMs ||
    DEFAULT_QURAN_DELAY_MS;

  const start = () => {
    // Quran first — it's fast and gives you a quick win.
    seedQuranEdition(edition, { delayMs: quranDelay }).catch((err) =>
      console.error('❌ Quran seeder crashed:', err)
    );
    seedBibleTranslation(translation, { delayMs: bibleDelay }).catch((err) =>
      console.error('❌ Bible seeder crashed:', err)
    );
  };

  if (mongoose.connection.readyState === 1) start();
  else mongoose.connection.once('connected', start);
}