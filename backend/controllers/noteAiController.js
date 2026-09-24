// controllers/noteAiController.js
//
// AI features for Personal Notes.
//
//   1. Scripture lookup    — highlight a Bible verse or Quran ayah → get the text
//   2. Scripture expand    — "show more verses" / "show full chapter/surah"
//   3. Topic search        — highlight anything else → get context + search links
//   4. Proofread           — spelling, punctuation, grammar, formatting fixes
//   5. Complete / expand   — add explanation, depth, examples to a note
//   6. Rewrite             — full rewrite: restructure, elaborate, reformat
//
// Every endpoint is READ-ONLY with respect to the note. Proofread, complete,
// and rewrite return SUGGESTED content — the client decides whether to keep
// it via the normal updateNote endpoint. Nothing is ever silently overwritten.

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
// INLINE GROQ CLIENT  (for the new rewrite endpoint)
// ─────────────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const stripCodeFences = (t) =>
  t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

async function callGroqRaw({ system, user, temperature = 0.5, maxTokens = 8192 }) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq API error (${response.status}): ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Groq returned an empty response.');
  try {
    return JSON.parse(stripCodeFences(raw));
  } catch {
    throw new Error('Groq returned invalid JSON.');
  }
}

// ─────────────────────────────────────────────────────────────────────
// Scripture source APIs — both free, no key required.
// ─────────────────────────────────────────────────────────────────────
const BIBLE_API = 'https://bible-api.com';
const QURAN_API = 'https://api.alquran.cloud/v1';
const DEFAULT_BIBLE_TRANSLATION = 'kjv';
const DEFAULT_QURAN_EDITION = 'en.asad';
const MAX_HIGHLIGHT_CHARS = 800;

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────
const loadReadableNote = async (noteId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(noteId)) {
    throw Object.assign(new Error('Invalid noteId.'), { status: 400 });
  }
  const note = await PersonalNote.findById(noteId);
  if (!note) throw Object.assign(new Error('Note not found.'), { status: 404 });

  const isOwner = note.user.toString() === userId;
  const isCollaborator = note.collaborators.some((c) => c.user.toString() === userId);
  if (!isOwner && !isCollaborator && !note.isPublic) {
    throw Object.assign(new Error('Access denied.'), { status: 403 });
  }
  return note;
};

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

async function fetchQuranPassage(surah, ayahStart, ayahEnd, edition = DEFAULT_QURAN_EDITION) {
  if (!surah || !ayahStart) throw new Error('Invalid Quran reference.');

  const start = Math.max(1, ayahStart);
  const end = Math.max(start, ayahEnd || start);

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

// ═════════════════════════════════════════════════════════════════════
// 1. LOOKUP SCRIPTURE (unchanged)
// ═════════════════════════════════════════════════════════════════════
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

    if (noteId) {
      try {
        await loadReadableNote(noteId, userId);
      } catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
      }
    }

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

    if (!detection || detection.type === 'general') {
      return res.status(200).json({
        success: true,
        result: {
          type: 'general',
          query: text.trim(),
          canExpand: false,
          next: 'search',
        },
      });
    }

    try {
      if (detection.type === 'bible' && detection.bible) {
        const b = detection.bible;
        const ref =
          b.verseStart && b.verseEnd && b.verseEnd > b.verseStart
            ? `${b.book} ${b.chapter}:${b.verseStart}-${b.verseEnd}`
            : b.verseStart
              ? `${b.book} ${b.chapter}:${b.verseStart}`
              : `${b.book} ${b.chapter}`;

        const passage = await fetchBiblePassage(ref);
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

// ═════════════════════════════════════════════════════════════════════
// 2. EXPAND SCRIPTURE (unchanged)
// ═════════════════════════════════════════════════════════════════════
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

    const { surah, ayahStart, ayahEnd } = parsed;
    if (!surah) {
      return res.status(400).json({ success: false, message: 'Invalid Quran reference.' });
    }

    let start;
    let end;
    if (expand === 'full_surah') {
      start = 1;
      end = 999;
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

// ═════════════════════════════════════════════════════════════════════
// 3. SEARCH (unchanged)
// ═════════════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════════════
// 4. PROOFREAD (unchanged)
// ═════════════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════════════
// 5. COMPLETE / EXPAND (unchanged)
// ═════════════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════════════
// 6. REWRITE  (new)
// ═════════════════════════════════════════════════════════════════════
//
// Unlike /complete (which only ADDS), /rewrite can restructure, retighten,
// reorder, and reformat the whole note. The author's core meaning and any
// facts they stated are preserved; everything else is fair game.
//
// Body:
//   { noteId }  OR  { content, title }
//   instructions?  free-form text like "make it more formal" or
//                  "expand on paragraph 3"
//   style?         explanatory | formal | casual | devotional | academic | journal
//   length?        shorter | same | longer | much_longer
//
// Returns: { original, rewrittenContent, changed, summary, changes, style, length }
// Does NOT save. Client calls updateNote if the user accepts.
// ═════════════════════════════════════════════════════════════════════

const REWRITE_SYSTEM = `
You are a bold, careful editor. You rewrite personal notes for their author.
The note arrives as Tiptap-compatible HTML and you return the rewritten note
in the SAME HTML dialect.

Unlike a proofread, this is a REWRITE. You are allowed — expected — to:
  • Restructure the note so the flow is clear
  • Break walls of text into paragraphs
  • Turn comma-runs and line-runs into real bullet or numbered lists
  • Promote short standalone lines above a block into headings (<h2> or <h3>)
  • Bold key terms, section labels, and short phrases the author meant as labels
  • Italicize foreign words, titles of works, and inner thoughts
  • Tighten wordy sentences without changing their meaning
  • Add transitions between ideas
  • Elaborate where the author was thin — but only with what they implied

If the user gave specific instructions (tone, length, focus, "expand on X"),
follow them precisely.

STYLE GUIDE (when a style is chosen):
  explanatory : define terms, add background, concrete examples
  formal      : professional tone, no contractions, structured
  casual      : friendly, contractions ok, direct address
  devotional  : reflective, warm, scripture-aware (never quote scripture)
  academic    : precise, structured, reasoned, no fluff
  journal     : first-person, reflective, personal, meandering ok

LENGTH GUIDE:
  shorter     : ~50-70% of original length
  same        : roughly same length, better organized
  longer      : ~130-180% of original, more depth
  much_longer : ~200-300% of original, fully developed

HARD RULES:
1. Preserve the author's CORE MEANING and any facts they stated.
2. Do NOT invent facts, quotes, dates, statistics, or scripture text.
   If you reference scripture, reference the reference ("see John 3:16"),
   never quote it.
3. Keep the author's voice unless the style explicitly changes it.
4. Return the FULL rewritten note — not a diff.
5. Only use these HTML tags: <p>, <h1>, <h2>, <h3>, <ul>, <ol>, <li>,
   <strong>, <em>, <u>, <s>, <a href="...">, <br>, and text-align on
   <p>/<h1>/<h2>/<h3>. No classes, no ids, no other CSS, no other tags.
6. NEVER wrap the entire output in a single container. Return sibling
   block elements, exactly like Tiptap emits.
7. If a change would be debatable, prefer the conservative choice.

Return STRICT JSON only:
{
  "rewrittenContent": "string (full rewritten note, Tiptap-compatible HTML)",
  "summary": "string (1-3 sentences on what you did overall)",
  "changes": [
    {
      "type": "structure" | "list" | "heading" | "emphasis" | "style"
            | "elaboration" | "tightening" | "tone" | "formatting",
      "original": "string (plain English description, no HTML)",
      "corrected": "string (plain English description, no HTML)",
      "reason": "string (short, plain English)"
    }
  ]
}

Order the changes array in the order they appear in the note.
If nothing meaningful changes, return the original content and an empty
changes array. Do not fabricate changes to look busy.
`.trim();

export const rewriteNoteHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      noteId,
      content: inlineContent,
      title: inlineTitle,
      instructions = '',
      style = 'explanatory',
      length = 'same',
    } = req.body;

    const allowedStyles = ['explanatory', 'formal', 'casual', 'devotional', 'academic', 'journal'];
    const allowedLengths = ['shorter', 'same', 'longer', 'much_longer'];
    const chosenStyle = allowedStyles.includes(style) ? style : 'explanatory';
    const chosenLength = allowedLengths.includes(length) ? length : 'same';

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
        message: 'Nothing to rewrite — the note is empty.',
      });
    }
    if (content.length > 20000) {
      return res.status(400).json({
        success: false,
        message: 'Note is too long to rewrite in one pass (max 20,000 chars).',
      });
    }
    if (typeof instructions === 'string' && instructions.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Instructions are too long (max 1000 chars).',
      });
    }

    const user = `
STYLE: ${chosenStyle}
LENGTH: ${chosenLength}
${instructions && instructions.trim() ? `\nUSER INSTRUCTIONS:\n${instructions.trim()}\n` : ''}
${title ? `\nNote title: ${title}\n` : ''}Note content (Tiptap HTML):
"""
${content}
"""
`.trim();

    let result;
    try {
      result = await callGroqRaw({
        system: REWRITE_SYSTEM,
        user,
        temperature: 0.55,
        maxTokens: 8192,
      });
    } catch (err) {
      console.error('❌ rewriteNote failed:', err);
      return res.status(502).json({
        success: false,
        message: 'The AI could not rewrite this note right now. Please try again.',
      });
    }

    const rewrittenContent =
      typeof result?.rewrittenContent === 'string' && result.rewrittenContent.trim()
        ? result.rewrittenContent
        : content;

    const changes = Array.isArray(result?.changes)
      ? result.changes
          .filter((c) => c && typeof c === 'object')
          .map((c) => ({
            type: String(c.type || 'rewrite').slice(0, 40),
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
        rewrittenContent,
        changed: rewrittenContent !== content,
        changeCount: changes.length,
        changes,
        summary: String(result?.summary || '').slice(0, 800),
        style: chosenStyle,
        length: chosenLength,
      },
    });
  } catch (err) {
    console.error('❌ noteAi rewriteNote error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Note rewrite failed.',
    });
  }
};