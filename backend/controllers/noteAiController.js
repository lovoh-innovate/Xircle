// controllers/noteAiController.js
//
// AI features for Personal Notes.
//
//   1. Scripture lookup    — highlight a Bible verse or Quran ayah → get the text
//   2. Scripture expand    — "show more verses" / "show full chapter/surah"
//   3. Topic search        — highlight anything else → get context + search links
//   4. Proofread           — spelling, punctuation, grammar, formatting fixes
//   5. Complete / expand   — add explanation, depth, examples to a note
//
// Every endpoint is READ-ONLY with respect to the note. Proofread and complete
// return SUGGESTED content — the client decides whether to keep it via the
// normal updateNote endpoint. That keeps the user in control and means nothing
// is ever silently overwritten.

import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import PersonalNote from '../models/personalNoteModel.js';
import {
  detectScripture,
  searchTopic,
  proofreadNote as aiProofreadNote,
  completeNote as aiCompleteNote,
} from '../services/geminiService.js';

// ─────────────────────────────────────────────────────────────────────
// Scripture source APIs — both free, no key required.
//   Bible:  https://bible-api.com
//   Quran:  https://api.alquran.cloud
// ─────────────────────────────────────────────────────────────────────
const BIBLE_API = 'https://bible-api.com';
const QURAN_API = 'https://api.alquran.cloud/v1';
const DEFAULT_BIBLE_TRANSLATION = 'kjv';
const DEFAULT_QURAN_EDITION = 'en.asad';
const MAX_HIGHLIGHT_CHARS = 800;

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

// Load a note and confirm the caller can read it. Used only when a noteId
// is supplied — the AI endpoints otherwise work on raw highlighted text.
const loadReadableNote = async (noteId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(noteId)) {
    throw Object.assign(new Error('Invalid noteId.'), { status: 400 });
  }
  const note = await PersonalNote.findById(noteId);
  if (!note) throw Object.assign(new Error('Note not found.'), { status: 404 });

  const isOwner = note.user.toString() === userId;
  const isCollaborator = note.collaborators.some(
    (c) => c.user.toString() === userId
  );
  if (!isOwner && !isCollaborator && !note.isPublic) {
    throw Object.assign(new Error('Access denied.'), { status: 403 });
  }
  return note;
};

// Fetch a Bible passage from bible-api.com. Accepts a free-form reference
// like "John 3:16" or "John 3" (whole chapter) or "John 3:16-21" (range).
async function fetchBiblePassage(reference, translation = DEFAULT_BIBLE_TRANSLATION) {
  const url = `${BIBLE_API}/${encodeURIComponent(reference)}?translation=${translation}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bible API error (${res.status})`);
  const data = await res.json();

  const verses = (data.verses || []).map((v) => ({
    book: v.book_name,
    chapter: v.chapter,
    verse: v.verse,
    text: v.text.trim(),
  }));

  return {
    reference: data.reference,
    translation: data.translation_name || translation.toUpperCase(),
    verses,
    text: (data.text || '').trim(),
    verseCount: verses.length,
  };
}

// Fetch a Quran passage from alquran.cloud. Single ayah is one call; ranges
// pull the whole surah once and slice it (the API has no native range endpoint).
async function fetchQuranPassage(surah, ayahStart, ayahEnd, edition = DEFAULT_QURAN_EDITION) {
  if (!surah || !ayahStart) throw new Error('Invalid Quran reference.');

  const start = Math.max(1, ayahStart);
  const end = Math.max(start, ayahEnd || start);

  // Single ayah
  if (start === end) {
    const res = await fetch(`${QURAN_API}/ayah/${surah}:${start}/${edition}`);
    if (!res.ok) throw new Error(`Quran API error (${res.status})`);
    const data = await res.json();
    const a = data.data;
    return {
      reference: `${a.surah.number}:${a.numberInSurah}`,
      surahName: `${a.surah.englishName} (${a.surah.name})`,
      surahNumber: a.surah.number,
      edition: a.edition?.englishName || edition,
      verses: [{ surah: a.surah.number, ayah: a.numberInSurah, text: a.text }],
      verseCount: 1,
    };
  }

  // Range — pull surah once and slice
  const res = await fetch(`${QURAN_API}/surah/${surah}/${edition}`);
  if (!res.ok) throw new Error(`Quran API error (${res.status})`);
  const data = await res.json();
  const all = data.data.ayahs || [];
  const sliced = all.filter((a) => a.numberInSurah >= start && a.numberInSurah <= end);

  return {
    reference: `${surah}:${start}-${end}`,
    surahName: `${data.data.englishName} (${data.data.name})`,
    surahNumber: data.data.number,
    edition: data.data.edition?.englishName || edition,
    verses: sliced.map((a) => ({
      surah: a.surah.number,
      ayah: a.numberInSurah,
      text: a.text,
    })),
    verseCount: sliced.length,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 1. LOOKUP SCRIPTURE
// POST /api/personal-notes/ai/scripture
//
// Body: { text: string, noteId?: string }
//
// Detects whether the highlighted text is a Bible reference, a Quran
// reference, or neither. If scripture, returns the actual passage text
// and the flags the frontend uses to render "Show more verses" /
// "Show full chapter" buttons.
//
// If neither, the client should call the /search endpoint instead — but
// we return a helpful payload either way so a single round-trip works.
// ─────────────────────────────────────────────────────────────────────
export const lookupScripture = async (req, res) => {
  try {
    const userId = req.user.id;
    const { text, noteId } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'text is required.' });
    }
    if (text.length > MAX_HIGHLIGHT_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Highlighted text is too long (max ${MAX_HIGHLIGHT_CHARS} chars).`,
      });
    }

    // Optional noteId → still enforce access so a stranger can't probe notes
    // by proxying through AI endpoints.
    if (noteId) {
      try {
        await loadReadableNote(noteId, userId);
      } catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
      }
    }

    // ── 1. Ask the model what this highlight actually is ───────────
    let detection;
    try {
      detection = await detectScripture({ text: text.trim() });
    } catch (err) {
      console.error('❌ detectScripture failed:', err);
      return res.status(502).json({
        success: false,
        message: 'Could not analyze the highlighted text right now.',
      });
    }

    // ── 2. Non-scripture → hand back search payload directly ───────
    if (!detection || detection.type === 'general') {
      return res.status(200).json({
        success: true,
        result: {
          type: 'general',
          query: text.trim(),
          canExpand: false,
          next: 'search', // hint for the client to call /search
        },
      });
    }

    // ── 3. Scripture → fetch the real text from the source API ─────
    try {
      if (detection.type === 'bible' && detection.bible) {
        const b = detection.bible;
        // Prefer an explicit range if the model supplied one, else single verse
        const ref =
          b.verseStart && b.verseEnd && b.verseEnd > b.verseStart
            ? `${b.book} ${b.chapter}:${b.verseStart}-${b.verseEnd}`
            : b.verseStart
            ? `${b.book} ${b.chapter}:${b.verseStart}`
            : `${b.book} ${b.chapter}`;

        const passage = await fetchBiblePassage(ref);

        // Heuristics for what "expand" would look like
        const fullChapter = await fetchBiblePassage(`${b.book} ${b.chapter}`);
        const canShowMore = passage.verseCount < fullChapter.verseCount;

        return res.status(200).json({
          success: true,
          result: {
            type: 'bible',
            parsed: {
              book: b.book,
              chapter: b.chapter,
              verseStart: b.verseStart || null,
              verseEnd: b.verseEnd || b.verseStart || null,
            },
            reference: passage.reference,
            translation: passage.translation,
            verses: passage.verses,
            text: passage.text,
            confidence: detection.confidence ?? null,
            canExpand: {
              moreVerses: canShowMore,
              fullChapter: fullChapter.verseCount > passage.verseCount,
            },
            expandOptions: [
              canShowMore && { id: 'more_verses', label: 'Show more verses' },
              fullChapter.verseCount > passage.verseCount && {
                id: 'full_chapter',
                label: `Show full ${b.book} ${b.chapter}`,
              },
            ].filter(Boolean),
          },
        });
      }

      if (detection.type === 'quran' && detection.quran) {
        const q = detection.quran;
        const passage = await fetchQuranPassage(q.surah, q.ayahStart, q.ayahEnd);

        // Compare against the full surah to know if we can expand
        const fullSurah = await fetchQuranPassage(q.surah, 1, 999);
        const canShowMore = passage.verseCount < fullSurah.verseCount;

        return res.status(200).json({
          success: true,
          result: {
            type: 'quran',
            parsed: {
              surah: q.surah,
              ayahStart: q.ayahStart || null,
              ayahEnd: q.ayahEnd || q.ayahStart || null,
            },
            reference: passage.reference,
            surahName: passage.surahName,
            surahNumber: passage.surahNumber,
            edition: passage.edition,
            verses: passage.verses,
            confidence: detection.confidence ?? null,
            canExpand: {
              moreVerses: canShowMore,
              fullSurah: fullSurah.verseCount > passage.verseCount,
            },
            expandOptions: [
              canShowMore && { id: 'more_verses', label: 'Show more ayahs' },
              fullSurah.verseCount > passage.verseCount && {
                id: 'full_surah',
                label: `Show full Surah ${passage.surahName}`,
              },
            ].filter(Boolean),
          },
        });
      }

      // Model said scripture but gave us nothing usable — treat as general.
      return res.status(200).json({
        success: true,
        result: {
          type: 'general',
          query: text.trim(),
          canExpand: false,
          next: 'search',
        },
      });
    } catch (err) {
      console.error('❌ Scripture fetch failed:', err);
      return res.status(502).json({
        success: false,
        message: 'We recognized the reference but could not load the passage.',
      });
    }
  } catch (err) {
    console.error('❌ noteAi lookupScripture error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Scripture lookup failed.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────
// 2. EXPAND SCRIPTURE
// POST /api/personal-notes/ai/scripture/expand
//
// Body:
//   {
//     type: 'bible',
//     parsed: { book, chapter, verseStart, verseEnd },
//     expand: 'more_verses' | 'full_chapter'
//   }
// OR
//   {
//     type: 'quran',
//     parsed: { surah, ayahStart, ayahEnd },
//     expand: 'more_verses' | 'full_surah'
//   }
//
// Returns the enlarged passage. Stateless — the client sends the parsed
// reference it got back from /scripture, so we never trust hidden state.
// ─────────────────────────────────────────────────────────────────────
export const expandScripture = async (req, res) => {
  try {
    const { type, parsed = {}, expand } = req.body;

    if (!type || !['bible', 'quran'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be bible or quran.' });
    }
    if (!expand) {
      return res.status(400).json({ success: false, message: 'expand is required.' });
    }

    if (type === 'bible') {
      const { book, chapter, verseStart, verseEnd } = parsed;
      if (!book || !chapter) {
        return res.status(400).json({ success: false, message: 'Invalid Bible reference.' });
      }

      let ref;
      if (expand === 'full_chapter') {
        ref = `${book} ${chapter}`;
      } else if (expand === 'more_verses') {
        // Extend the range by ~5 verses. bible-api clamps at end of chapter.
        const start = verseStart || 1;
        const end = Math.max(verseEnd || start, start) + 5;
        ref = `${book} ${chapter}:${start}-${end}`;
      } else {
        return res.status(400).json({ success: false, message: 'Unknown expand mode.' });
      }

      const passage = await fetchBiblePassage(ref);
      const fullChapter = await fetchBiblePassage(`${book} ${chapter}`);

      return res.status(200).json({
        success: true,
        result: {
          type: 'bible',
          reference: passage.reference,
          translation: passage.translation,
          verses: passage.verses,
          text: passage.text,
          canExpand: {
            moreVerses: passage.verseCount < fullChapter.verseCount,
            fullChapter: fullChapter.verseCount > passage.verseCount,
          },
        },
      });
    }

    // Quran
    const { surah, ayahStart, ayahEnd } = parsed;
    if (!surah) {
      return res.status(400).json({ success: false, message: 'Invalid Quran reference.' });
    }

    let start;
    let end;
    if (expand === 'full_surah') {
      start = 1;
      end = 999; // fetchQuranPassage clamps at the last ayah in the surah
    } else if (expand === 'more_verses') {
      start = ayahStart || 1;
      end = Math.max(ayahEnd || start, start) + 4;
    } else {
      return res.status(400).json({ success: false, message: 'Unknown expand mode.' });
    }

    const passage = await fetchQuranPassage(surah, start, end);
    const fullSurah = await fetchQuranPassage(surah, 1, 999);

    return res.status(200).json({
      success: true,
      result: {
        type: 'quran',
        reference: passage.reference,
        surahName: passage.surahName,
        surahNumber: passage.surahNumber,
        edition: passage.edition,
        verses: passage.verses,
        canExpand: {
          moreVerses: passage.verseCount < fullSurah.verseCount,
          fullSurah: fullSurah.verseCount > passage.verseCount,
        },
      },
    });
  } catch (err) {
    console.error('❌ noteAi expandScripture error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Could not expand the passage.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────
// 3. SEARCH A HIGHLIGHTED WORD / PHRASE
// POST /api/personal-notes/ai/search
//
// Body: { text: string, context?: string, noteId?: string }
//
// Used when the highlight isn't scripture. Returns a short summary,
// definitions, related topics, and ready-made search links (Google,
// Wikipedia, etc.) the client can render as buttons.
// ─────────────────────────────────────────────────────────────────────
export const searchHighlight = async (req, res) => {
  try {
    const userId = req.user.id;
    const { text, context, noteId } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'text is required.' });
    }
    if (text.length > MAX_HIGHLIGHT_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Highlighted text is too long (max ${MAX_HIGHLIGHT_CHARS} chars).`,
      });
    }

    if (noteId) {
      try {
        await loadReadableNote(noteId, userId);
      } catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
      }
    }

    let aiResult;
    try {
      aiResult = await searchTopic({
        text: text.trim(),
        context: (context || '').slice(0, 2000),
      });
    } catch (err) {
      console.error('❌ searchTopic failed:', err);
      return res.status(502).json({
        success: false,
        message: 'Could not search right now. Please try again.',
      });
    }

    const q = encodeURIComponent(text.trim());
    const wikiSlug = encodeURIComponent(text.trim().replace(/\s+/g, '_'));

    return res.status(200).json({
      success: true,
      result: {
        type: 'general',
        query: text.trim(),
        summary: aiResult.summary || '',
        definitions: Array.isArray(aiResult.definitions) ? aiResult.definitions : [],
        relatedTopics: Array.isArray(aiResult.relatedTopics) ? aiResult.relatedTopics : [],
        suggestedSearches: Array.isArray(aiResult.suggestedSearches)
          ? aiResult.suggestedSearches.slice(0, 5)
          : [],
        searchLinks: [
          { label: 'Google', url: `https://www.google.com/search?q=${q}` },
          { label: 'Wikipedia', url: `https://en.wikipedia.org/wiki/Special:Search?search=${wikiSlug}` },
          { label: 'Dictionary', url: `https://www.merriam-webster.com/dictionary/${q}` },
        ],
      },
    });
  } catch (err) {
    console.error('❌ noteAi searchHighlight error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Search failed.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────
// 4. PROOFREAD A NOTE
// POST /api/personal-notes/ai/proofread
//
// Body: { noteId } OR { content, title? }
//
// Returns SUGGESTED corrected content — does NOT save. The client shows a
// diff/preview and calls updateNote if the user accepts.
// ─────────────────────────────────────────────────────────────────────
export const proofreadNoteHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const { noteId, content: inlineContent, title: inlineTitle } = req.body;

    let title = inlineTitle || '';
    let content = inlineContent || '';

    if (noteId) {
      let note;
      try {
        note = await loadReadableNote(noteId, userId);
      } catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
      }
      title = note.title;
      content = note.content;
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nothing to proofread — the note is empty.',
      });
    }
    if (content.length > 20000) {
      return res.status(400).json({
        success: false,
        message: 'Note is too long to proofread in one pass (max 20,000 chars).',
      });
    }

    let result;
    try {
      result = await aiProofreadNote({ title, content });
    } catch (err) {
      console.error('❌ proofreadNote failed:', err);
      return res.status(502).json({
        success: false,
        message: 'Proofreading failed right now. Please try again.',
      });
    }

    // Guard against the model returning junk
    const correctedContent =
      typeof result?.correctedContent === 'string' && result.correctedContent.trim()
        ? result.correctedContent
        : content;

    const changes = Array.isArray(result?.changes)
      ? result.changes
          .filter((c) => c && typeof c === 'object')
          .map((c) => ({
            type: String(c.type || 'edit'),
            original: String(c.original || '').slice(0, 400),
            corrected: String(c.corrected || '').slice(0, 400),
            reason: String(c.reason || '').slice(0, 300),
          }))
          .slice(0, 200)
      : [];

    return res.status(200).json({
      success: true,
      result: {
        original: content,
        correctedContent,
        changed: correctedContent !== content,
        changeCount: changes.length,
        changes,
        summary: String(result?.summary || '').slice(0, 600),
      },
    });
  } catch (err) {
    console.error('❌ noteAi proofreadNote error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Proofreading failed.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────
// 5. COMPLETE / EXPAND A NOTE
// POST /api/personal-notes/ai/complete
//
// Body: { noteId, style? } OR { content, title?, style? }
//
//   style — 'explanatory' | 'concise' | 'devotional' | 'academic' | 'journal'
//           (default: 'explanatory')
//
// Returns a longer version that adds explanation, examples, and context
// while preserving the author's original text and voice. Does NOT save.
// ─────────────────────────────────────────────────────────────────────
export const completeNoteHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      noteId,
      content: inlineContent,
      title: inlineTitle,
      style = 'explanatory',
    } = req.body;

    const allowedStyles = ['explanatory', 'concise', 'devotional', 'academic', 'journal'];
    const chosenStyle = allowedStyles.includes(style) ? style : 'explanatory';

    let title = inlineTitle || '';
    let content = inlineContent || '';

    if (noteId) {
      let note;
      try {
        note = await loadReadableNote(noteId, userId);
      } catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
      }
      title = note.title;
      content = note.content;
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nothing to expand — the note is empty.',
      });
    }
    if (content.length > 20000) {
      return res.status(400).json({
        success: false,
        message: 'Note is too long to expand in one pass (max 20,000 chars).',
      });
    }

    let result;
    try {
      result = await aiCompleteNote({ title, content, style: chosenStyle });
    } catch (err) {
      console.error('❌ completeNote failed:', err);
      return res.status(502).json({
        success: false,
        message: 'The AI could not expand this note right now.',
      });
    }

    const completedContent =
      typeof result?.completedContent === 'string' && result.completedContent.trim()
        ? result.completedContent
        : content;

    const addedSections = Array.isArray(result?.addedSections)
      ? result.addedSections
          .filter((s) => s && typeof s === 'object')
          .map((s) => ({
            type: String(s.type || 'addition'),
            heading: String(s.heading || '').slice(0, 200),
            content: String(s.content || '').slice(0, 3000),
          }))
          .slice(0, 20)
      : [];

    return res.status(200).json({
      success: true,
      result: {
        original: content,
        completedContent,
        style: chosenStyle,
        addedSections,
        rationale: String(result?.rationale || '').slice(0, 800),
      },
    });
  } catch (err) {
    console.error('❌ noteAi completeNote error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Note completion failed.',
    });
  }
};